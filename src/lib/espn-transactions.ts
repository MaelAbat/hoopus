import https from "node:https";
import { createHash } from "node:crypto";
import { seasonForEventDate } from "./season-phases";
import type { EventAsset, EventContract, EventKind, EventPlayer } from "./market";
import type { ParsedEvent } from "./br-transactions";

/**
 * Mouvements de la ligue, depuis ESPN.
 *
 * Basketball Reference reste la source de référence pour l'historique : son
 * balisage porte la direction des échanges et des liens vers chaque joueur. Mais
 * il publie avec retard. Au 4 août 2026, sa page de transactions s'arrêtait au
 * 9 juillet et ses pages d'équipe 2026-27 n'existaient pas encore : ni l'arrivée
 * de LeBron James à Philadelphie, ni l'échange à trois envoyant Zaccharie
 * Risacher à Dallas n'y figuraient, alors que l'intersaison était faite.
 *
 * ESPN, lui, est à jour au jour près. Il apporte même une information que BR
 * n'a pas : la distinction explicite entre « Signed » et « Re-signed », qui dit
 * une prolongation sans avoir à la déduire des effectifs.
 *
 * Le prix à payer est une source en prose : ni identifiants de joueur, ni
 * structure. Tout se lit dans la phrase, avec ses formulations propres —
 * positions au pluriel (« Gs LaMelo Ball and Josh Green »), plusieurs mouvements
 * par entrée (« Signed F LeBron James to a contract. Waived F Dalen Terry. »),
 * et des équipes citées tantôt par leur ville, tantôt en entier.
 */

const API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const PAGE_SIZE = 50;

/**
 * Tricodes ESPN qui diffèrent de ceux de la NBA. Le même écart est traité dans
 * /api/sync-injuries, l'autre lecteur ESPN du site.
 */
const ESPN_TRICODE_MAP: Record<string, string> = {
  GS: "GSW",
  NY: "NYK",
  SA: "SAS",
  NO: "NOP",
  WSH: "WAS",
  UTAH: "UTA",
};

function nbaTricode(espn: string): string {
  return ESPN_TRICODE_MAP[espn.toUpperCase()] || espn.toUpperCase();
}

/* ─── Accès réseau ─── */

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: "application/json" } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`ESPN: HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T);
        } catch {
          reject(new Error("ESPN: réponse illisible"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("ESPN: délai dépassé"));
    });
  });
}

interface EspnTransaction {
  date: string;
  description: string;
  team?: { abbreviation?: string; location?: string; name?: string; displayName?: string };
}

interface EspnPage {
  count?: number;
  pageCount?: number;
  transactions?: EspnTransaction[];
}

interface EspnTeamsResponse {
  sports: { leagues: { teams: { team: { abbreviation: string; location: string; name: string; displayName: string } }[] }[] }[];
}

/**
 * Index des équipes citées en prose.
 *
 * Les phrases nomment une équipe par sa ville (« from Dallas »), par son nom
 * complet (« from Phoenix Suns »), ou par son surnom. « Los Angeles » seul reste
 * volontairement non résolu : deux franchises y jouent, et deviner serait pire
 * que de ne rien affirmer.
 */
export async function fetchTeamIndex(): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  const data = await fetchJson<EspnTeamsResponse>(`${API}/teams`);
  const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? [];

  const ambiguous = new Set<string>();
  for (const { team } of teams) {
    const tricode = nbaTricode(team.abbreviation);
    for (const label of [team.displayName, team.name, `${team.location} ${team.name}`]) {
      if (label) index.set(normalize(label), tricode);
    }
    const city = normalize(team.location);
    if (index.has(city) && index.get(city) !== tricode) ambiguous.add(city);
    else index.set(city, tricode);
  }
  for (const city of ambiguous) index.delete(city);

  return index;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Toutes les transactions d'une année civile, pages comprises. */
export async function fetchEspnTransactions(year?: number): Promise<EspnTransaction[]> {
  const suffix = year ? `&season=${year}` : "";
  const first = await fetchJson<EspnPage>(`${API}/transactions?limit=${PAGE_SIZE}${suffix}`);
  const all = [...(first.transactions ?? [])];
  const pages = Math.min(first.pageCount ?? 1, 40);

  for (let page = 2; page <= pages; page++) {
    const next = await fetchJson<EspnPage>(`${API}/transactions?limit=${PAGE_SIZE}&page=${page}${suffix}`);
    all.push(...(next.transactions ?? []));
  }

  return all;
}

/* ─── Découpage des phrases ─── */

/**
 * Une entrée ESPN peut porter plusieurs mouvements. Le découpage se fait devant
 * les verbes connus, et non sur chaque point : « Signed G J.R. Smith » et
 * « F Larry Nance Jr. to a contract » se feraient sinon couper en deux.
 */
const VERBS =
  "Signed|Re-signed|Waived|Released|Acquired|Traded|Converted|Claimed|Hired|Fired|Named|Placed|Announced|Exercised|Declined|Assigned|Recalled";

export function splitSentences(description: string): string[] {
  return description
    .split(new RegExp(`(?<=\\.)\\s+(?=(?:${VERBS})\\b)`))
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ─── Lecture d'une phrase ─── */

/** Positions utilisées par ESPN, singulier et pluriel. */
const POSITION = "(?:PG|SG|SF|PF|[CFG]-[CFG]|[CFG])s?";

/**
 * Retire la ponctuation de fin de phrase d'un nom, sans toucher aux points qui
 * font partie du nom : « Jamahl Mosley. » devient « Jamahl Mosley », mais
 * « Larry Nance Jr. » et « A.J. Lawson » restent intacts.
 */
function cleanName(name: string): string {
  const trimmed = name.trim();
  return /\b(?:Jr|Sr|[A-Z])\.$/.test(trimmed) ? trimmed : trimmed.replace(/[.,;]+$/, "");
}

/** Un nom trouvé dans une phrase, et sa position — utile pour situer l'équipe. */
export interface PlayerMention {
  name: string;
  index: number;
}

/**
 * Noms de joueurs d'un fragment, dans l'ordre, avec leur position dans le texte.
 *
 * ESPN préfixe systématiquement un nom par sa position, ce qui permet de le
 * distinguer d'un nom de ville. La liste des positions est fermée : sans cela
 * « AJ Johnson » ou « CJ McCollum » seraient lus comme des positions.
 *
 * Au pluriel, la position ne s'écrit qu'une fois pour deux joueurs — « Gs LaMelo
 * Ball and Josh Green » — d'où la lecture du nom qui suit la conjonction.
 */
export function playerMentions(text: string): PlayerMention[] {
  const mentions: PlayerMention[] = [];
  const pattern = new RegExp(
    `\\b(${POSITION})\\s+((?:[A-ZÀ-Ý][\\w'’.\\-]*)(?:\\s+(?:[A-ZÀ-Ý][\\w'’.\\-]*|Jr\\.|Sr\\.|II|III|IV))*)`,
    "g"
  );

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const name = cleanName(match[2]);
    if (name) mentions.push({ name, index: match.index });

    if (match[1].endsWith("s")) {
      const after = text.slice(match.index + match[0].length);
      const conjoined = after.match(/^\s+and\s+((?:[A-ZÀ-Ý][\w'’.\-]*)(?:\s+[A-ZÀ-Ý][\w'’.\-]*)*)/);
      if (conjoined) {
        mentions.push({
          name: cleanName(conjoined[1]),
          index: match.index + match[0].length + conjoined[0].length,
        });
      }
    }
  }

  return mentions;
}

/** Noms seuls, quand leur position dans la phrase n'importe pas. */
export function playersInText(text: string): string[] {
  return playerMentions(text).map((m) => m.name);
}

/**
 * Équipe citée dans un fragment, si elle est reconnue sans ambiguïté.
 *
 * C'est la mention la plus proche du début qui gagne, et non le libellé le plus
 * long. ESPN fait suivre ses échanges d'un commentaire — « ... that sent F
 * Zaccharie Risacher to Dallas. Dallas received draft consideration from Atlanta,
 * while Oklahoma City received... » — où « Oklahoma City » est plus long que
 * « Dallas » : préférer le libellé long envoyait Risacher dans la mauvaise
 * équipe. À position égale, le libellé le plus long tranche, pour préférer
 * « Phoenix Suns » à « Phoenix ».
 */
export function teamInText(text: string, teams: Map<string, string>): string | null {
  const haystack = normalize(text);
  let best: { index: number; length: number; tricode: string } | null = null;

  for (const [label, tricode] of teams) {
    const match = haystack.match(new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
    if (!match || match.index === undefined) continue;
    if (
      !best ||
      match.index < best.index ||
      (match.index === best.index && label.length > best.length)
    ) {
      best = { index: match.index, length: label.length, tricode };
    }
  }

  return best?.tricode ?? null;
}

function detectContract(text: string): EventContract | null {
  const t = text.toLowerCase();
  if (/two-way/.test(t)) return { type: "two_way", detail: null };
  if (/10-day|ten-day/.test(t)) return { type: "ten_day", detail: null };
  if (/rest of the season/.test(t)) return { type: "rest_of_season", detail: null };
  if (/exhibit 10/.test(t)) return { type: "exhibit_10", detail: null };
  if (/rookie scale|multiyear|multi-year/.test(t)) return { type: "multi_year", detail: null };
  // « to a contract » ne dit rien de sa nature : ne rien affirmer.
  return null;
}

function assetsInText(text: string): Omit<EventAsset, "from" | "to">[] {
  const found: Omit<EventAsset, "from" | "to">[] = [];
  if (/draft consideration/i.test(text)) {
    found.push({ type: "pick", year: null, round: null, detail: "draft consideration" });
  }
  if (/\bcash\b/i.test(text)) found.push({ type: "cash", year: null, round: null, detail: null });
  return found;
}

const COACH_ROLES: [RegExp, string][] = [
  [/head coach/i, "entraîneur principal"],
  [/assistant coach/i, "entraîneur adjoint"],
  [/general manager/i, "manager général"],
  [/president/i, "président"],
];

/** Nom d'une personne de l'encadrement, qui n'a pas de position devant lui. */
function coachInText(text: string): string | null {
  const patterns = [
    /(?:head coach|assistant coach|general manager|president(?:[^.]*?)?)\s+([A-ZÀ-Ý][\w'’.\-]*(?:\s+[A-ZÀ-Ý][\w'’.\-]*)*)/,
    /(?:Hired|Fired|Named|resignation of|retirement of)\s+([A-ZÀ-Ý][\w'’.\-]*(?:\s+[A-ZÀ-Ý][\w'’.\-]*)*)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return cleanName(match[1]);
  }
  return null;
}

function coachingDetail(text: string): string {
  const role = COACH_ROLES.find(([re]) => re.test(text))?.[1] ?? "membre de son encadrement";
  if (/\bFired\b/i.test(text)) return `limoge son ${role}`;
  if (/\bHired\b/i.test(text)) return `engage son ${role}`;
  if (/\bNamed\b/i.test(text)) return `nomme son ${role}`;
  if (/resignation/i.test(text)) return `voit démissionner son ${role}`;
  return `modifie son encadrement (${role})`;
}

/** Type de mouvement décrit par une phrase ESPN. */
export function classifyEspn(text: string): EventKind {
  // « Signed head coach Charles Lee to a contract extension » : le verbe dit
  // signature, la personne dit encadrement. C'est la personne qui compte.
  if (/\b(?:head coach|assistant coach|general manager)\b/i.test(text)) return "coaching";
  if (/^Re-signed/i.test(text)) return "extension";
  if (/^Signed/i.test(text)) return "signature";
  if (/^(?:Waived|Released)/i.test(text) || /\bon waivers\b/i.test(text)) return "waiver";
  if (/^Claimed/i.test(text)) return "claim";
  if (/^(?:Acquired|Traded)/i.test(text)) return "trade";
  if (/^Converted/i.test(text)) return "conversion";
  if (/^(?:Hired|Fired|Named)/i.test(text) || /resignation of/i.test(text)) return "coaching";
  if (/retirement of/i.test(text)) return "retirement";
  if (/^(?:Exercised|Declined)/i.test(text)) return "option";
  if (/^Assigned/i.test(text)) return "assignment";
  if (/^Recalled/i.test(text)) return "recall";
  return "other";
}

/**
 * Sens de circulation d'un échange décrit en prose.
 *
 * Trois formulations cohabitent : « for », « in exchange for » et « in a
 * three-team trade that sent ». Ce qui précède revient à l'équipe sujet, ce qui
 * suit la quitte.
 */
function parseTrade(
  text: string,
  subject: string,
  teams: Map<string, string>
): { players: EventPlayer[]; assets: EventAsset[]; involved: string[] } {
  const players: EventPlayer[] = [];
  const assets: EventAsset[] = [];
  const involved = new Set<string>([subject]);

  // ESPN commente parfois l'échange après coup (« Dallas received draft
  // consideration from Atlanta, while... »). Ce commentaire nomme des équipes qui
  // brouilleraient la lecture des destinations : on s'arrête à la première phrase.
  const operative = text.split(/\.\s+(?=[A-Z])/)[0];
  const [incoming, outgoing = ""] = operative.split(
    /\bin exchange for\b|\bthat sent\b|\bfor\b(?![^.]*\bfrom\b)/i
  );

  /**
   * L'équipe attachée à un joueur : celle nommée entre lui et le joueur suivant
   * — « Nembhard from Dallas and Dort from Oklahoma City » — à défaut celle citée
   * ailleurs dans le fragment. On ne découpe pas sur « and », qui sépare aussi
   * deux joueurs partageant une même position.
   */
  const sideTeams = (part: string, mentions: PlayerMention[]): (string | null)[] => {
    const fallback = teamInText(part, teams);
    return mentions.map((mention, i) => {
      const until = mentions[i + 1]?.index ?? part.length;
      const scope = part.slice(mention.index, until);
      return teamInText(scope, teams) ?? fallback;
    });
  };

  const inMentions = playerMentions(incoming);
  const inTeams = sideTeams(incoming, inMentions);
  inMentions.forEach((mention, i) => {
    const origin = inTeams[i];
    if (origin) involved.add(origin);
    players.push({
      name: mention.name,
      br_slug: null,
      player_id: null,
      from: origin,
      to: subject,
      role: "player",
    });
  });
  const incomingFrom = teamInText(incoming, teams);
  if (incomingFrom) involved.add(incomingFrom);
  for (const asset of assetsInText(incoming)) {
    assets.push({ ...asset, from: incomingFrom, to: subject });
  }

  if (outgoing) {
    const outMentions = playerMentions(outgoing);
    const outTeams = sideTeams(outgoing, outMentions);
    outMentions.forEach((mention, i) => {
      const destination = outTeams[i] ?? incomingFrom;
      if (destination) involved.add(destination);
      players.push({
        name: mention.name,
        br_slug: null,
        player_id: null,
        from: subject,
        to: destination,
        role: "player",
      });
    });
    const outgoingTo = teamInText(outgoing, teams) ?? incomingFrom;
    for (const asset of assetsInText(outgoing)) {
      assets.push({ ...asset, from: subject, to: outgoingTo });
    }
  }

  return { players, assets, involved: [...involved] };
}

/** Construit un mouvement depuis une phrase ESPN. */
export function parseEspnSentence(
  sentence: string,
  date: string,
  subject: string,
  teams: Map<string, string>
): ParsedEvent | null {
  const text = sentence.trim();
  if (text.length < 6) return null;

  const kind = classifyEspn(text);
  const contract = detectContract(text);

  let players: EventPlayer[] = [];
  let assets: EventAsset[] = [];
  let allTeams = [subject];
  let fromTeam: string | null = null;
  let toTeam: string | null = null;
  let detail: string | null = null;

  if (kind === "trade") {
    const trade = parseTrade(text, subject, teams);
    players = trade.players;
    assets = trade.assets;
    allTeams = trade.involved;
    fromTeam = subject;
    toTeam = trade.involved.find((t) => t !== subject) ?? null;
  } else if (kind === "coaching" || kind === "retirement") {
    const name = coachInText(text);
    if (name) {
      players = [
        {
          name,
          br_slug: null,
          player_id: null,
          from: null,
          to: null,
          role: kind === "coaching" ? "coach" : "player",
        },
      ];
    }
    if (kind === "coaching") detail = coachingDetail(text);
  } else {
    // La position manque parfois (« Signed Tre Donaldson to a two-way
    // contract. ») : on lit alors le nom qui suit le verbe.
    const names = playersInText(text);
    if (names.length === 0) {
      const bare = text.match(
        /^(?:Signed|Re-signed|Waived|Released|Claimed|Converted|Placed|Exercised|Declined|Assigned|Recalled)(?:\s+the\s+contract\s+of)?\s+((?:[A-ZÀ-Ý][\w'’.\-]*)(?:\s+(?:[A-ZÀ-Ý][\w'’.\-]*|Jr\.|Sr\.|II|III|IV))*)/
      );
      if (bare) names.push(bare[1].replace(/[.,;]+$/, "").trim());
    }
    const arriving = kind === "signature" || kind === "extension" || kind === "claim" || kind === "recall";
    const leaving = kind === "waiver" || kind === "assignment";

    if (arriving) toTeam = subject;
    if (leaving) fromTeam = subject;
    if (kind === "conversion" || kind === "option") {
      fromTeam = subject;
      toTeam = subject;
    }

    players = names.map((name) => ({
      name,
      br_slug: null,
      player_id: null,
      from: fromTeam,
      to: toTeam,
      role: "player" as const,
    }));
    assets = assetsInText(text).map((a) => ({ ...a, from: fromTeam, to: toTeam }));
  }

  // Une phrase sans personne identifiée n'apporte rien d'exploitable — sauf un
  // échange qui ne porte que des choix de draft (« Acquired draft consideration
  // from Memphis. »), qui reste un mouvement, et l'encadrement où le nom peut
  // manquer.
  const carriesAssets = kind === "trade" && assets.length > 0;
  if (players.length === 0 && !carriesAssets && kind !== "coaching" && kind !== "other") return null;

  return {
    event_key: espnEventKey(date, subject, text),
    event_date: date,
    season: seasonForEventDate(date),
    kind,
    teams: allTeams,
    from_team: fromTeam,
    to_team: toTeam,
    players,
    assets,
    contract,
    detail,
    raw: text,
  };
}

/**
 * Empreinte d'un mouvement ESPN. L'équipe sujet en fait partie : les deux côtés
 * d'un échange produisent des phrases quasi identiques, et seule l'équipe qui les
 * publie les distingue.
 */
export function espnEventKey(date: string, subject: string, text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha1").update(`espn|${date}|${subject}|${normalized}`).digest("hex");
}

export interface EspnScrape {
  events: ParsedEvent[];
  /** Entrées lues, avant découpage en phrases. */
  entries: number;
  /** Phrases qu'aucune règle n'a su exploiter. */
  skipped: string[];
}

/**
 * Mouvements ESPN d'une année civile, prêts à être écrits.
 *
 * ESPN raisonne en année civile, pas en saison : le rattachement se fait ensuite
 * par date, comme pour Basketball Reference.
 */
export async function fetchEspnEvents(year?: number): Promise<EspnScrape> {
  const [transactions, teams] = await Promise.all([fetchEspnTransactions(year), fetchTeamIndex()]);
  const events = new Map<string, ParsedEvent>();
  const skipped: string[] = [];

  for (const entry of transactions) {
    const date = entry.date?.slice(0, 10);
    const espnTeam = entry.team?.abbreviation;
    if (!date || !espnTeam || !entry.description) continue;
    const subject = nbaTricode(espnTeam);

    for (const sentence of splitSentences(entry.description)) {
      const event = parseEspnSentence(sentence, date, subject, teams);
      if (event) events.set(event.event_key, event);
      else skipped.push(sentence);
    }
  }

  return { events: [...events.values()], entries: transactions.length, skipped };
}
