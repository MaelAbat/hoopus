import { createHash } from "node:crypto";
import { BR_TRICODE_MAP, normalizeName } from "./br-salaries";
import { fetchBrHtml, isNotFound } from "./br-fetch";
import { seasonStartYear } from "./season";
import { seasonForEventDate } from "./season-phases";
import type { EventAsset, EventContract, EventKind, EventPlayer } from "./market";

/**
 * Journal des mouvements, depuis Basketball Reference.
 *
 * Une page par saison, `leagues/NBA_{année}_transactions.html`, où l'année est
 * celle de fin de saison. Chaque jour est un `<li>` contenant un `<p>` par
 * mouvement.
 *
 * Ce que la source offre de précieux : chaque équipe citée porte un attribut de
 * direction — `data-attr-from` pour celle qui cède, `data-attr-to` pour celle qui
 * reçoit. Le sens d'un échange se lit donc dans le balisage, sans avoir à
 * interpréter la phrase.
 *
 * Deux limites assumées :
 *
 *   * BR produit des lignes incomplètes (« The traded FROM_TRADE to the
 *     Minnesota Timberwolves »). Le texte brut est toujours conservé, et un
 *     mouvement mal découpé s'affiche sobrement plutôt que de disparaître.
 *   * Le découpage d'une page ne correspond pas exactement à une saison : la page
 *     2026 commence en février 2025 et se poursuit en juillet 2026. Chaque
 *     mouvement est donc rattaché à une saison d'après sa date, jamais d'après la
 *     page qui le porte.
 */

/** Un mouvement tel que la page le donne, avant tout enrichissement. */
export interface ParsedEvent {
  event_key: string;
  event_date: string;
  season: string;
  kind: EventKind;
  teams: string[];
  from_team: string | null;
  to_team: string | null;
  players: EventPlayer[];
  assets: EventAsset[];
  contract: EventContract | null;
  detail: string | null;
  raw: string;
}

/**
 * Pages à lire pour couvrir une saison.
 *
 * Deux, parce que l'intersaison est à cheval : au 1er août 2026, les signatures
 * de juillet — qui appartiennent à la saison 2026-27 — figurent encore sur la
 * page de la saison 2025-26, celle de 2026-27 n'existant pas (404). L'appelant
 * tolère l'absence de la première.
 */
export function transactionPageUrls(season: string): string[] {
  const start = seasonStartYear(season);
  return [start + 1, start].map(
    (endYear) => `https://www.basketball-reference.com/leagues/NBA_${endYear}_transactions.html`
  );
}

/* ─── Découpage du document ─── */

type Token =
  | { type: "team"; tricode: string; role: "from" | "to" | null }
  | { type: "player"; name: string; slug: string | null; isCoach: boolean }
  | { type: "text"; text: string };

/**
 * Annotations entre parenthèses, retirées de la phrase avant analyse.
 *
 * BR enrichit ses lignes anciennes de précisions ajoutées après coup : « a 2020
 * 2nd round draft pick (Xavier Tillman Sr. was later selected) ». Le joueur cité
 * n'a pas été échangé — il a été sélectionné cinq ans plus tard avec ce choix. Le
 * laisser dans la phrase revenait à faire échanger en 2015 un joueur qui n'était
 * pas encore professionnel : c'est le genre d'erreur qui discrédite une page.
 *
 * Les autres annotations (protections, droits d'échange de choix, durée de
 * suspension) sont conservées comme précisions, pas comme participants.
 */
const ANNOTATION_PATTERN = /\(([^()]*)\)/g;
const ANNOTATION_KEYWORDS =
  /was (?:later )?selected|protect|swap|suspension|pick is|picks? from|trade with|as part of trade/i;

export function extractAnnotations(html: string): { cleaned: string; annotations: string[] } {
  const annotations: string[] = [];
  const cleaned = html.replace(ANNOTATION_PATTERN, (whole, inner: string) => {
    const text = stripTags(inner);
    if (!ANNOTATION_KEYWORDS.test(text)) return whole;
    annotations.push(text);
    return " ";
  });
  return { cleaned, annotations };
}

const TEAM_HREF = /^\/teams\/([A-Z]{3})\//;
const PLAYER_HREF = /^\/players\/[a-z]\/([a-z0-9]+)\.html/;
const COACH_HREF = /^\/coaches\/([a-z0-9]+)\.html/;

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tricode NBA depuis un identifiant Basketball Reference. */
function nbaTricode(brTricode: string): string {
  return BR_TRICODE_MAP[brTricode] || brTricode;
}

/**
 * Découpe un paragraphe en jetons ordonnés : équipes, joueurs, texte.
 * L'ordre compte — c'est lui qui donne le sens d'un échange.
 */
export function tokenizeTransaction(html: string): Token[] {
  const tokens: Token[] = [];
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  const pushText = (raw: string) => {
    const text = stripTags(raw);
    if (text) tokens.push({ type: "text", text });
  };

  while ((match = anchor.exec(html)) !== null) {
    pushText(html.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const attrs = match[1];
    const label = stripTags(match[2]);
    const href = attrs.match(/href="([^"]+)"/)?.[1] ?? "";

    const teamHref = href.match(TEAM_HREF);
    if (teamHref) {
      const from = attrs.match(/data-attr-from="([A-Z]{3})"/)?.[1];
      const to = attrs.match(/data-attr-to="([A-Z]{3})"/)?.[1];
      tokens.push({
        type: "team",
        tricode: nbaTricode(from || to || teamHref[1]),
        role: from ? "from" : to ? "to" : null,
      });
      continue;
    }

    const playerHref = href.match(PLAYER_HREF);
    if (playerHref && label) {
      tokens.push({ type: "player", name: label, slug: playerHref[1], isCoach: false });
      continue;
    }

    // Entraîneurs et dirigeants : même place dans la phrase, pas de fiche joueur.
    const coachHref = href.match(COACH_HREF);
    if (coachHref && label) {
      tokens.push({ type: "player", name: label, slug: coachHref[1], isCoach: true });
      continue;
    }

    pushText(match[2]);
  }

  pushText(html.slice(cursor));
  return tokens;
}

/* ─── Classification ─── */

/**
 * Type du mouvement. L'ordre des tests n'est pas indifférent : une réclamation au
 * ballottage contient le mot « waivers » sans être une coupe, et une conversion
 * mentionne le contrat d'origine sans être une signature.
 */
export function classifyKind(text: string): EventKind {
  const t = text.toLowerCase();
  if (/\bsuspended\b/.test(t)) return "suspension";
  if (/\b(hired|fired|appointed|reassigned)\b|\bresigns? as\b|\bnamed\b.*\bcoach\b/.test(t)) {
    return "coaching";
  }
  if (/\btraded\b|\btrade\b.*\bfor\b/.test(t)) return "trade";
  if (/\bclaimed\b/.test(t)) return "claim";
  if (/\bconverted\b/.test(t)) return "conversion";
  if (/\bwaived\b|\breleased\b/.test(t)) return "waiver";
  if (/\bassigned\b/.test(t)) return "assignment";
  if (/\brecalled\b/.test(t)) return "recall";
  if (/\bretirement\b|\bretired\b/.test(t)) return "retirement";
  if (/\bexercised\b|\bdeclined\b|\boption\b/.test(t)) return "option";
  if (/\bsigned\b|\bre-signed\b|\bdrafted\b|\bselected\b/.test(t)) return "signature";
  return "other";
}

/**
 * Nature du contrat, quand la phrase la précise.
 *
 * Renvoie `null` faute d'indice : BR écrit souvent « signed Eric Gordon » sans
 * plus de détail, et supposer un contrat standard serait une affirmation
 * gratuite. Pour une conversion, c'est le contrat d'arrivée qui compte.
 */
export function detectContract(text: string, kind: EventKind): EventContract | null {
  const t = text.toLowerCase();

  if (kind === "conversion") {
    if (/to a (regular|standard) contract/.test(t)) return { type: "standard", detail: null };
    if (/to a two-way/.test(t)) return { type: "two_way", detail: null };
    return null;
  }

  if (/two-way/.test(t)) return { type: "two_way", detail: null };
  if (/10-day|ten-day/.test(t)) return { type: "ten_day", detail: null };
  if (/multi-year/.test(t)) return { type: "multi_year", detail: null };
  if (/rest of the season|remainder of the season/.test(t)) {
    return { type: "rest_of_season", detail: null };
  }
  if (/exhibit 10/.test(t)) return { type: "exhibit_10", detail: null };
  return null;
}

/**
 * Postes de l'encadrement, du plus précis au plus général — « interim Head
 * Coach » contient « head coach », l'ordre des tests tranche.
 */
const COACH_ROLES: [RegExp, string][] = [
  [/interim head coach/i, "entraîneur par intérim"],
  [/assistant coach/i, "entraîneur adjoint"],
  [/head coach/i, "entraîneur principal"],
  [/general manager/i, "manager général"],
  [/president/i, "président"],
  [/coach/i, "entraîneur"],
];

/** Phrase française d'un mouvement d'encadrement, poste compris. */
export function coachingDetail(text: string): string {
  const role = COACH_ROLES.find(([re]) => re.test(text))?.[1] ?? "membre de son encadrement";
  if (/\bfired\b/i.test(text)) return `limoge son ${role}`;
  if (/\bhired\b/i.test(text)) return `engage son ${role}`;
  if (/\bappointed\b|\bnamed\b/i.test(text)) return `nomme son ${role}`;
  if (/\bresigns?\b/i.test(text)) return `voit démissionner son ${role}`;
  if (/\breassigned\b/i.test(text)) return `réaffecte son ${role}`;
  return `modifie son encadrement (${role})`;
}

/** Durée d'une suspension, telle que BR l'annote. */
export function suspensionDetail(text: string): string | null {
  const games = text.match(/(\d+)-game suspension/i);
  if (games) return `${games[1]} match${Number(games[1]) > 1 ? "s" : ""}`;
  if (/indefinite/i.test(text)) return "durée indéterminée";
  return null;
}

/** Actifs cités dans un fragment de phrase, hors joueurs. */
function assetsInText(text: string): Omit<EventAsset, "from" | "to">[] {
  const found: Omit<EventAsset, "from" | "to">[] = [];

  // « a 2032 2nd round draft pick », « 2027 and 2029 1st round draft picks »
  const pickPattern = /(\d{4})(?:\s*(?:,|and)\s*(\d{4}))?\s+(1st|2nd)\s+round\s+draft\s+pick/gi;
  let match: RegExpExecArray | null;
  while ((match = pickPattern.exec(text)) !== null) {
    const round = match[3].toLowerCase() === "1st" ? 1 : 2;
    for (const year of [match[1], match[2]]) {
      if (year) found.push({ type: "pick", year: Number(year), round, detail: null });
    }
  }

  if (/\bcash\b|cash considerations/i.test(text)) {
    found.push({ type: "cash", year: null, round: null, detail: null });
  }
  if (/trade exception/i.test(text)) {
    found.push({ type: "exception", year: null, round: null, detail: null });
  }
  if (/right to swap|pick swap|swap rights/i.test(text)) {
    found.push({ type: "swap", year: null, round: null, detail: null });
  }
  const rights = text.match(/draft rights to ([A-Z][^,.]+)/);
  if (rights) {
    found.push({ type: "rights", year: null, round: null, detail: rights[1].trim() });
  }

  return found;
}

/* ─── Assemblage d'un mouvement ─── */

/**
 * Sens de circulation d'un échange.
 *
 * On suit les jetons dans l'ordre : tout ce qui est cité avant l'équipe qui
 * reçoit part vers elle ; après le « for », les contreparties reviennent vers
 * l'équipe sujet. Ce parcours gère aussi les échanges à trois équipes, chaque
 * `data-attr-to` refermant le lot en cours.
 */
function assignTradeDirections(tokens: Token[]): {
  players: EventPlayer[];
  assets: EventAsset[];
  subject: string | null;
  firstTarget: string | null;
} {
  const players: EventPlayer[] = [];
  const assets: EventAsset[] = [];

  const teams = tokens.filter((t): t is Extract<Token, { type: "team" }> => t.type === "team");
  const subject = teams.find((t) => t.role === "from")?.tricode ?? teams[0]?.tricode ?? null;

  let currentFrom = subject;
  let currentTo: string | null = null;
  let firstTarget: string | null = null;
  let returning = false;

  let pendingPlayers: { name: string; slug: string | null }[] = [];
  let pendingAssets: Omit<EventAsset, "from" | "to">[] = [];

  const flush = (to: string | null) => {
    const from = returning ? to : currentFrom;
    const dest = returning ? currentFrom : to;
    for (const p of pendingPlayers) {
      players.push({
        name: p.name,
        br_slug: p.slug,
        player_id: null,
        from: from ?? null,
        to: dest ?? null,
        role: "player",
      });
    }
    for (const a of pendingAssets) {
      assets.push({ ...a, from: from ?? null, to: dest ?? null });
    }
    pendingPlayers = [];
    pendingAssets = [];
  };

  for (const token of tokens) {
    if (token.type === "player") {
      pendingPlayers.push({ name: token.name, slug: token.slug });
      continue;
    }
    if (token.type === "text") {
      pendingAssets.push(...assetsInText(token.text));
      // « for » / « in exchange for » : ce qui suit revient vers l'équipe sujet.
      if (/\bin exchange for\b|\bfor\b\s*$|\bfor\b\s+the\b/.test(token.text) && currentTo) {
        flush(currentTo);
        returning = true;
      }
      continue;
    }
    // Jeton d'équipe.
    if (token.role === "to") {
      flush(token.tricode);
      currentTo = token.tricode;
      firstTarget ??= token.tricode;
      returning = false;
    } else if (token.role === "from") {
      if (currentFrom && token.tricode !== currentFrom) flush(currentTo);
      currentFrom = token.tricode;
    }
  }

  flush(currentTo);
  return { players, assets, subject, firstTarget };
}

/** Construit un mouvement depuis un paragraphe et sa date. */
export function parseTransaction(html: string, date: string): ParsedEvent | null {
  // `raw` garde la ligne d'origine, annotations comprises : c'est la trace
  // vérifiable, et la clé d'idempotence en dépend.
  const raw = stripTags(html);
  if (!raw || raw.length < 8) return null;

  // L'analyse, elle, travaille sur la phrase débarrassée de ses annotations
  // rétrospectives — sans quoi « was later selected » ferait passer un échange
  // pour une sélection, et le joueur cité pour un joueur échangé.
  const { cleaned, annotations } = extractAnnotations(html);
  const sentence = stripTags(cleaned);

  const tokens = tokenizeTransaction(cleaned);
  const kind = classifyKind(sentence);
  const contract = detectContract(sentence, kind);
  const teamTokens = tokens.filter((t): t is Extract<Token, { type: "team" }> => t.type === "team");
  const teams = [...new Set(teamTokens.map((t) => t.tricode))];
  const playerTokens = tokens.filter((t): t is Extract<Token, { type: "player" }> => t.type === "player");

  let players: EventPlayer[] = [];
  let assets: EventAsset[] = [];
  let fromTeam: string | null = null;
  let toTeam: string | null = null;

  if (kind === "trade") {
    const result = assignTradeDirections(tokens);
    players = result.players;
    assets = result.assets;
    fromTeam = result.subject;
    toTeam = result.firstTarget;
  } else {
    const receiving = teamTokens.find((t) => t.role === "to")?.tricode ?? null;
    const releasing = teamTokens.find((t) => t.role === "from")?.tricode ?? null;

    switch (kind) {
      case "signature":
      case "recall":
        toTeam = receiving ?? releasing;
        break;
      case "waiver":
      case "assignment":
        fromTeam = releasing ?? receiving;
        break;
      case "claim":
        toTeam = receiving;
        fromTeam = releasing;
        break;
      case "conversion":
      case "option":
        fromTeam = releasing ?? receiving;
        toTeam = fromTeam;
        break;
      default:
        fromTeam = releasing;
        toTeam = receiving;
    }

    // Une suspension ou une retraite n'a pas d'équipe d'accueil : le joueur ne
    // bouge pas, il sort du jeu.
    const stationary = kind === "suspension" || kind === "retirement" || kind === "coaching";

    players = playerTokens.map((p) => ({
      name: p.name,
      br_slug: p.slug,
      player_id: null,
      from: stationary ? null : fromTeam,
      to: stationary ? null : toTeam,
      role: p.isCoach ? ("coach" as const) : ("player" as const),
    }));
    assets = assetsInText(sentence).map((a) => ({ ...a, from: fromTeam, to: toTeam }));
  }

  // Précisions de BR, en fin de ligne ou entre parenthèses, rattachées au choix
  // concerné plutôt que perdues.
  attachPickNotes(raw, annotations, assets);

  return {
    event_key: eventKey(date, raw),
    event_date: date,
    season: seasonForEventDate(date),
    kind,
    teams,
    from_team: fromTeam,
    to_team: toTeam,
    players,
    assets,
    contract,
    detail:
      kind === "suspension"
        ? suspensionDetail(raw)
        : kind === "coaching"
          ? coachingDetail(sentence)
          : null,
    raw,
  };
}

/**
 * Rattache les précisions aux choix de draft correspondants.
 *
 * Deux formes cohabitent : les notes de fin de ligne (« 2032 2nd-rd pick is GSW
 * own ») et les annotations entre parenthèses (« Xavier Tillman Sr. was later
 * selected », protections). Les premières se rapprochent par année et tour ; les
 * secondes suivent l'ordre des choix dans la phrase.
 */
function attachPickNotes(raw: string, annotations: string[], assets: EventAsset[]) {
  const picks = assets.filter((a) => a.type === "pick");

  for (const note of raw.match(/(\d{4}) (1st|2nd)-rd pick[^.]*/g) || []) {
    const [, year, round] = note.match(/(\d{4}) (1st|2nd)-rd/)!;
    const target = picks.find(
      (a) => a.year === Number(year) && a.round === (round === "1st" ? 1 : 2)
    );
    if (target) target.detail = note.trim();
  }

  // « Xavier Tillman Sr. was later selected » : le joueur finalement sélectionné
  // avec ce choix. Une information précieuse — c'est elle qui donne son sens à un
  // second tour cédé dix ans plus tôt — à condition de rester une note.
  const selections = annotations.filter((a) => /was (?:later )?selected/i.test(a));
  let cursor = 0;
  for (const note of selections) {
    const name = note.replace(/\s*was (?:later )?selected\.?$/i, "").trim();
    const target = picks[cursor++];
    if (!target || !name) continue;
    const suffix = `${name} sélectionné avec ce choix`;
    target.detail = target.detail ? `${target.detail} — ${suffix}` : suffix;
  }

  for (const note of annotations.filter((a) => /protect|swap/i.test(a))) {
    const target = picks.find((a) => !a.detail) ?? picks[0];
    if (target) target.detail = target.detail ? `${target.detail} — ${note}` : note;
  }
}

/**
 * Empreinte d'un mouvement.
 *
 * La source n'a aucun identifiant : la date et le texte normalisé font office de
 * clé. `season` en est volontairement absente, pour que faire évoluer la règle de
 * rattachement ne crée pas de doublons.
 */
export function eventKey(date: string, raw: string): string {
  const normalized = raw.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha1").update(`${date}|${normalized}`).digest("hex");
}

/* ─── Lecture d'une page ─── */

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** Convertit « July 2, 2025 » en « 2025-07-02 ». */
export function parseBrDate(label: string): string | null {
  const match = label.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
}

/** Tous les mouvements d'une page, dédoublonnés par empreinte. */
export function parseTransactionsPage(html: string): ParsedEvent[] {
  const events = new Map<string, ParsedEvent>();
  const days = html.match(/<li[^>]*>[\s\S]*?<\/li>/g) || [];

  for (const day of days) {
    const label = day.match(/<span>([A-Z][a-z]+ \d{1,2}, \d{4})<\/span>/);
    if (!label) continue;
    const date = parseBrDate(label[1]);
    if (!date) continue;

    for (const paragraph of day.match(/<p>[\s\S]*?<\/p>/g) || []) {
      const event = parseTransaction(paragraph, date);
      if (event) events.set(event.event_key, event);
    }
  }

  return [...events.values()];
}

export interface TransactionScrape {
  events: ParsedEvent[];
  /** Pages effectivement lues. */
  pagesRead: string[];
  /** Pages absentes — normal pour une saison à venir. */
  missing: string[];
}

/**
 * Mouvements d'une saison, quelle que soit la période de l'année.
 *
 * Les deux pages candidates sont lues et fusionnées : une même transaction
 * présente sur les deux produit la même empreinte, donc une seule ligne.
 */
export async function fetchSeasonTransactions(
  season: string,
  onProgress?: (message: string) => void
): Promise<TransactionScrape> {
  const events = new Map<string, ParsedEvent>();
  const pagesRead: string[] = [];
  const missing: string[] = [];

  for (const url of transactionPageUrls(season)) {
    try {
      const parsed = parseTransactionsPage(await fetchBrHtml(url));
      for (const event of parsed) events.set(event.event_key, event);
      pagesRead.push(url);
      onProgress?.(`${url.split("/").pop()} — ${parsed.length} mouvements`);
    } catch (err) {
      if (isNotFound(err)) {
        missing.push(url);
        onProgress?.(`${url.split("/").pop()} — page absente`);
        continue;
      }
      throw err;
    }
  }

  return { events: [...events.values()], pagesRead, missing };
}

/**
 * Renseigne les identifiants NBA des joueurs par rapprochement de noms.
 *
 * Basketball Reference ne donne qu'un identifiant maison. Le rapprochement passe
 * donc par le nom normalisé, comme pour les salaires — avec le même taux
 * d'échec résiduel sur les homonymes et les suffixes. Un joueur non résolu reste
 * affiché, simplement sans lien vers sa fiche.
 */
export function attachPlayerIds(events: ParsedEvent[], byName: Map<string, number>): number {
  let resolved = 0;
  for (const event of events) {
    for (const player of event.players) {
      const id = byName.get(normalizeName(player.name));
      if (id) {
        player.player_id = id;
        resolved++;
      }
    }
  }
  return resolved;
}
