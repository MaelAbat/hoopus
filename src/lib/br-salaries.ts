import https from "node:https";
import { seasonStartYear } from "./season";

/**
 * Récupération des salaires depuis Basketball Reference.
 *
 * Deux sources, parce qu'aucune ne couvre toute l'année :
 *
 *   `/teams/{TRI}/{année}.html`  Table « Salaries » verrouillée sur une saison.
 *                                Source de référence, mais BR ne publie la page
 *                                qu'une fois la saison entamée (404 avant).
 *   `/contracts/{TRI}.html`      Seule source pour la saison à venir. Sa colonne
 *                                `y1` glisse d'une saison à l'autre au fil de
 *                                l'année, d'où la validation de son en-tête.
 *
 * La validation de l'en-tête est le garde-fou central : c'est en lisant `y1`
 * sans vérifier ce qu'il annonçait que des salaires de l'année N+1 se sont
 * retrouvés rangés sous l'année N. Mieux vaut aucun salaire qu'un salaire
 * attribué à la mauvaise saison.
 */

/** Correspondance des tricodes BR qui diffèrent de ceux de la NBA. */
export const BR_TRICODE_MAP: Record<string, string> = {
  PHO: "PHX",
  BRK: "BKN",
  CHO: "CHA",
};

/** Les 30 identifiants d'équipe côté Basketball Reference. */
export const BR_TEAMS = [
  "ATL", "BOS", "BRK", "CHI", "CHO", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHO", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Intervalle entre deux requêtes, en séquentiel.
 *
 * Basketball Reference tolère une vingtaine de requêtes par minute. 3,2 s
 * laisse environ 18/min, sous le seuil, marges comprises.
 */
const REQUEST_INTERVAL_MS = 3200;
/**
 * Temps maximal accordé à un balayage.
 * La fonction serverless est plafonnée à 60 s : on garde de la marge pour les
 * écritures en base qui suivent.
 */
const DEFAULT_BUDGET_MS = 38_000;
/** Tentatives par page, en cas de limitation. */
const ATTEMPTS = 3;

/**
 * Normalise un nom pour rapprocher les deux sources.
 *
 * Les tables de salaires de BR omettent les suffixes générationnels
 * (« Kevin Porter » là où la NBA écrit « Kevin Porter Jr. »).
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ (jr|sr|ii|iii|iv|v)$/, "")
    .trim();
}

function fetchHtml(url: string, redirects = 0): Promise<string> {
  if (redirects > 5) return Promise.reject(new Error("Too many redirects"));
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          let location = res.headers.location;
          if (location.startsWith("/")) {
            const parsed = new URL(url);
            location = `${parsed.protocol}//${parsed.host}${location}`;
          }
          res.resume();
          fetchHtml(location, redirects + 1).then(resolve, reject);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            // Le statut voyage avec l'erreur : un 404 signifie « page pas encore
            // publiée », ce qui appelle l'autre source plutôt qu'un abandon.
            const err = new Error(`HTML fetch error: ${res.statusCode}`) as Error & {
              status?: number;
            };
            err.status = res.statusCode;
            reject(err);
            return;
          }
          resolve(Buffer.concat(chunks).toString("utf-8"));
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

/**
 * `fetchHtml` avec reprise sur limitation de débit.
 *
 * Basketball Reference renvoie 429 quand les appels se succèdent trop vite. Ce
 * n'est pas une erreur définitive, contrairement à un 404 qui signifie « page
 * pas encore publiée » et qui ne doit surtout pas être réessayé.
 */
async function fetchHtmlResilient(url: string): Promise<string> {
  let lastError: Error = new Error("jamais tenté");

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await fetchHtml(url);
    } catch (err) {
      lastError = err as Error;
      const status = (err as Error & { status?: number }).status;
      const retryable = !status || status === 429 || status === 403 || status >= 500;
      if (attempt === ATTEMPTS || !retryable) throw err;
      // 4s puis 12s : une limitation de débit se dissipe en quelques secondes.
      const wait = 4000 * Math.pow(3, attempt - 1);
      console.warn(`[BR] ${lastError.message} — nouvelle tentative ${attempt + 1}/${ATTEMPTS} dans ${wait}ms`);
      await delay(wait);
    }
  }

  throw lastError;
}

/**
 * Isole la table « Salaries » d'une page équipe-saison.
 *
 * BR la sert dans un commentaire HTML (elle est montée côté client), donc on
 * découpe la section au lieu de parser un DOM.
 */
export function extractSalariesSection(html: string): string {
  const start = html.indexOf('id="all_salaries');
  if (start === -1) return "";
  const end = html.indexOf("</table>", start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

/**
 * Couples (nom normalisé, salaire) d'un fragment de tableau, dédoublonnés.
 *
 * Le dédoublonnage compte : certaines pages répètent leur tableau, et cumuler
 * naïvement gonflerait la masse salariale.
 */
export function parseSalaryRows(section: string, salaryCell: "salary" | "y1"): Map<string, string> {
  const found = new Map<string, string>();
  const rows = section.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const salaryPattern = new RegExp(`data-stat="${salaryCell}"[^>]*>(\\$[\\d,]+)`);

  for (const row of rows) {
    // Le nom est tantôt dans un <td>, tantôt dans un <th> selon la page, et
    // tantôt enveloppé d'un lien — d'où le préfixe optionnel.
    const playerMatch = row.match(/data-stat="player"[^>]*>\s*(?:<a[^>]*>)?([^<]+)/);
    if (!playerMatch) continue;
    const name = normalizeName(playerMatch[1]);
    if (!name) continue; // en-tête de colonne, ligne de total
    const salaryMatch = row.match(salaryPattern);
    if (!salaryMatch) continue;
    found.set(name, salaryMatch[1]);
  }

  return found;
}

/** Saison annoncée par la colonne `y1` d'une page de contrats. */
export function readContractsSeason(html: string): string | null {
  const header = html.match(/<th[^>]*data-stat="y1"[^>]*>([^<]+)</);
  const advertised = header?.[1]?.trim();
  return advertised && /^\d{4}-\d{2}$/.test(advertised) ? advertised : null;
}

export interface TeamSalaries {
  salaries: Map<string, string>;
  source: "season-page" | "contracts";
}

/**
 * Salaires d'une équipe pour une saison donnée, quelle que soit la période de
 * l'année. Renvoie `null` si aucune source exploitable.
 */
export async function fetchTeamSalaries(
  brTeam: string,
  season: string
): Promise<TeamSalaries | null> {
  const seasonEndYear = seasonStartYear(season) + 1;

  // 1. Page de saison — verrouillée, donc préférable.
  try {
    const html = await fetchHtmlResilient(
      `https://www.basketball-reference.com/teams/${brTeam}/${seasonEndYear}.html`
    );
    const section = extractSalariesSection(html);
    const salaries = parseSalaryRows(section, "salary");
    if (salaries.size > 0) return { salaries, source: "season-page" };
  } catch (err) {
    if ((err as Error & { status?: number }).status !== 404) throw err;
  }

  // 2. Page de contrats — uniquement si elle annonce bien la saison demandée.
  const html = await fetchHtmlResilient(`https://www.basketball-reference.com/contracts/${brTeam}.html`);
  const advertised = readContractsSeason(html);
  if (advertised !== season) {
    console.warn(
      `[BR] ${brTeam}: /contracts/ annonce ${advertised ?? "?"}, attendu ${season} — page ignorée`
    );
    return null;
  }

  const salaries = parseSalaryRows(html, "y1");
  return salaries.size > 0 ? { salaries, source: "contracts" } : null;
}

export interface SalaryScrape {
  /** Clé `nom normalisé|TRICODE NBA` → salaire formaté (« $54,126,450 »). */
  salaryMap: Map<string, string>;
  /** Équipes NBA effectivement récupérées. */
  fetched: string[];
  /** Équipes pour lesquelles aucune source n'a abouti. */
  failed: string[];
}

/** Identifiant Basketball Reference d'une équipe, depuis son tricode NBA. */
export function brTeamFor(nbaTricode: string): string {
  const inverted = Object.entries(BR_TRICODE_MAP).find(([, nba]) => nba === nbaTricode);
  return inverted ? inverted[0] : nbaTricode;
}

/**
 * Salaires individuels des équipes demandées.
 *
 * Volontairement séquentiel et espacé : Basketball Reference limite à une
 * vingtaine de requêtes par minute et répond 429 au-delà, avec un blocage qui
 * dure. Trois requêtes en parallèle toutes les 2,5 s dépassaient largement ce
 * seuil et faisaient échouer la moitié de la ligue.
 *
 * Aucune masse salariale n'est calculée ici. Le total est dérivé une seule fois,
 * dans sync-rosters, à partir des salaires réellement attribués aux joueurs —
 * garantissant que le total affiché est bien la somme des contrats affichés.
 */
export async function fetchAllSalaries(
  season: string,
  teams: string[] = BR_TEAMS,
  budgetMs = DEFAULT_BUDGET_MS
): Promise<SalaryScrape> {
  const salaryMap = new Map<string, string>();
  const fetched: string[] = [];
  const failed: string[] = [];
  const deadline = Date.now() + budgetMs;

  for (const [i, brTeam] of teams.entries()) {
    const nbaTeam = BR_TRICODE_MAP[brTeam] || brTeam;

    // Borne de temps : une série de 429 déclenche des reprises qui feraient
    // dépasser la durée maximale de la fonction. Les équipes non traitées sont
    // reprises au passage suivant, la priorisation les remettant en tête.
    if (Date.now() > deadline) {
      const remaining = teams.slice(i).map((t) => BR_TRICODE_MAP[t] || t);
      console.warn(
        `[BR] Budget de temps atteint — ${remaining.length} équipe(s) reportée(s) : ${remaining.join(", ")}`
      );
      break;
    }

    try {
      const result = await fetchTeamSalaries(brTeam, season);
      if (!result) {
        failed.push(nbaTeam);
      } else {
        for (const [name, salary] of result.salaries) {
          salaryMap.set(`${name}|${nbaTeam}`, salary);
        }
        fetched.push(nbaTeam);
        console.log(`[BR] ${nbaTeam}: ${result.salaries.size} salaires (${result.source})`);
      }
    } catch (err) {
      console.error(`[BR] ${nbaTeam} échec:`, (err as Error).message);
      failed.push(nbaTeam);
    }

    if (i < teams.length - 1) await delay(REQUEST_INTERVAL_MS);
  }

  console.log(
    `[BR] ${salaryMap.size} salaires sur ${fetched.length}/${teams.length} équipe(s)` +
      (failed.length > 0 ? `, échecs : ${failed.join(", ")}` : "")
  );

  return { salaryMap, fetched, failed };
}
