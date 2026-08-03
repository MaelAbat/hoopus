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

/** Nombre de pages sollicitées en parallèle. Volontairement bas : BR renvoie 429. */
const CONCURRENCY = 3;
/** Pause entre deux lots. */
const BATCH_DELAY_MS = 2500;
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
  /** Tricode NBA → masse salariale de l'équipe. */
  payrollMap: Map<string, number>;
  /** Équipes pour lesquelles aucune source n'a abouti. */
  failed: string[];
}

/**
 * Salaires individuels et masses salariales des 30 équipes.
 *
 * Les deux sortent du même tableau par équipe, donc les totaux restent
 * cohérents avec les contrats affichés. Nuance : une page de saison recense
 * tous les joueurs payés par la franchise sur l'année, un joueur échangé en
 * cours de saison peut donc être compté par ses deux équipes.
 */
export async function fetchAllSalaries(season: string): Promise<SalaryScrape> {
  const salaryMap = new Map<string, string>();
  const payrollMap = new Map<string, number>();
  const failed: string[] = [];

  for (let i = 0; i < BR_TEAMS.length; i += CONCURRENCY) {
    const batch = BR_TEAMS.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (brTeam) => {
        const nbaTeam = BR_TRICODE_MAP[brTeam] || brTeam;
        try {
          const result = await fetchTeamSalaries(brTeam, season);
          if (!result) {
            failed.push(nbaTeam);
            return;
          }
          let total = 0;
          for (const [name, salary] of result.salaries) {
            salaryMap.set(`${name}|${nbaTeam}`, salary);
            total += Number(salary.replace(/[$,]/g, "")) || 0;
          }
          if (total > 0) payrollMap.set(nbaTeam, total);
          console.log(
            `[BR] ${nbaTeam}: ${result.salaries.size} salaires (${result.source}), ` +
              `${(total / 1e6).toFixed(1)} M$`
          );
        } catch (err) {
          console.error(`[BR] ${nbaTeam} échec:`, (err as Error).message);
          failed.push(nbaTeam);
        }
      })
    );
    // Un peu d'air entre les lots, pour rester courtois avec BR.
    if (i + CONCURRENCY < BR_TEAMS.length) await delay(BATCH_DELAY_MS);
  }

  console.log(
    `[BR] ${salaryMap.size} salaires, ${payrollMap.size} masses salariales` +
      (failed.length > 0 ? `, ${failed.length} équipe(s) en échec : ${failed.join(", ")}` : "")
  );

  return { salaryMap, payrollMap, failed };
}
