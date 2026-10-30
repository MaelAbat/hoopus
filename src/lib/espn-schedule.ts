/**
 * Calendrier et scores de la ligue, lus chez ESPN.
 *
 * Les API de la NBA refusent nos accès depuis l'été 2026 : CDN en 403, et
 * stats.nba.com qui ne répond plus. ESPN publie le même calendrier, mais sous
 * ses propres identifiants de match — ils sont préfixés (`E401909881`) pour ne
 * jamais être lus comme des identifiants NBA, et la saison, le type de match
 * et le tour de playoffs sont donnés explicitement au lieu d'être encodés dans
 * l'identifiant.
 *
 * ESPN n'accepte pas de plage de dates sur son scoreboard : la saison complète
 * se reconstitue à partir du calendrier de chacune des trente équipes, chaque
 * match y figurant deux fois.
 */

import { fetchEspnJson } from "./espn-fetch";
import { espnGameId, nbaTricode, seasonFromEspnYear } from "./espn-teams";

const API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

/** Types de saison ESPN, et leur équivalent sur le site. */
const SEASON_TYPES: Record<number, GameRow["game_type"]> = {
  1: "preseason",
  2: "regular",
  3: "playoffs",
  5: "playin",
};

/** Ligne de la table `games`, au format écrit par les syncs. */
export interface GameRow {
  game_id: string;
  game_date: string;
  game_time: string;
  status: number;
  status_text: string;
  home_team: string;
  home_team_name: string;
  home_score: number;
  away_team: string;
  away_team_name: string;
  away_score: number;
  arena: string;
  arena_city: string;
  season: string;
  source: "espn";
  game_type: "preseason" | "regular" | "playoffs" | "playin";
  playoff_round: number | null;
  updated_at: string;
}

/* ─── Formes des réponses ESPN, limitées à ce qui est lu ─── */

interface EspnCompetitor {
  homeAway: "home" | "away";
  team: { abbreviation: string; shortDisplayName?: string; name?: string };
  /** Objet dans les calendriers d'équipe, chaîne dans le scoreboard. */
  score?: string | { value?: number };
}

interface EspnStatus {
  displayClock?: string;
  period?: number;
  type: { name: string; state: "pre" | "in" | "post"; completed: boolean; detail?: string; shortDetail?: string };
}

export interface EspnEvent {
  id: string;
  date: string;
  season?: { year: number; type: number };
  seasonType?: { id: string; type: number };
  competitions: {
    timeValid?: boolean;
    venue?: { fullName?: string; address?: { city?: string } };
    competitors: EspnCompetitor[];
    status: EspnStatus;
    notes?: { headline?: string }[];
  }[];
}

/* ─── Conversion ─── */

const ET_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Date et heure de New York — le site range les matchs comme la NBA, en heure de l'Est. */
function easternParts(iso: string): { date: string; hour: number; minute: number } {
  const parts = Object.fromEntries(
    ET_PARTS.formatToParts(new Date(iso)).map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function scoreOf(c: EspnCompetitor | undefined): number {
  if (!c?.score) return 0;
  const raw = typeof c.score === "string" ? c.score : c.score.value;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** « 7:30 pm ET », comme le texte de statut des matchs NBA à venir. */
function startLabel(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"} ET`;
}

/**
 * Statut au format du site : 1 à venir, 2 en cours, 3 terminé. Un match reporté
 * ou annulé (« post » sans être terminé) reste à venir, avec le libellé d'ESPN.
 */
function statusOf(s: EspnStatus, hour: number, minute: number, timeValid: boolean): { status: number; text: string } {
  if (s.type.state === "in") {
    if (s.type.name === "STATUS_HALFTIME") return { status: 2, text: "Half" };
    if (s.type.name === "STATUS_END_PERIOD") return { status: 2, text: `End Q${s.period ?? ""}` };
    const period = s.period ?? 0;
    const label = period > 4 ? `OT${period - 4 > 1 ? period - 4 : ""}` : `Q${period}`;
    return { status: 2, text: `${label} ${s.displayClock ?? ""}`.trim() };
  }
  if (s.type.state === "post" && s.type.completed) {
    // ESPN écrit « Final/2OT », la NBA « Final/OT2 ».
    const detail = (s.type.detail || "Final").replace(/^Final\/(\d+)OT$/, "Final/OT$1");
    return { status: 3, text: detail };
  }
  if (s.type.state === "post") {
    return { status: 1, text: s.type.shortDetail || s.type.detail || "" };
  }
  return { status: 1, text: timeValid ? startLabel(hour, minute) : "TBD" };
}

/** Tour de playoffs lu dans la note du match (« East 1st Round - Game 3 », « NBA Finals - Game 1 »). */
function playoffRound(headline: string | undefined): number | null {
  if (!headline) return null;
  if (/finals/i.test(headline) && !/conf/i.test(headline)) return 4;
  if (/conf(erence)?\.? finals/i.test(headline)) return 3;
  if (/semifinals|2nd round|second round/i.test(headline)) return 2;
  if (/1st round|first round/i.test(headline)) return 1;
  return null;
}

/** Convertit un match ESPN en ligne `games`, ou `null` pour un type de match que le site ne suit pas. */
export function toGameRow(event: EspnEvent, now: string): GameRow | null {
  const comp = event.competitions[0];
  if (!comp) return null;

  const typeId = event.season?.type ?? event.seasonType?.type;
  const gameType = typeId != null ? SEASON_TYPES[typeId] : undefined;
  // Présaison et All-Star : écartés, comme dans la sync NBA.
  if (!gameType || gameType === "preseason") return null;

  const year = event.season?.year;
  if (!year) return null;

  const home = comp.competitors.find((c) => c.homeAway === "home");
  const away = comp.competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const { date, hour, minute } = easternParts(event.date);
  const timeValid = comp.timeValid !== false;
  const { status, text } = statusOf(comp.status, hour, minute, timeValid);

  return {
    game_id: espnGameId(event.id),
    game_date: date,
    // Même convention que la NBA : l'heure de l'Est, posée sur une date fictive.
    game_time: timeValid
      ? `1900-01-01T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`
      : "1900-01-01T00:00:00Z",
    status,
    status_text: text,
    home_team: nbaTricode(home.team.abbreviation),
    home_team_name: home.team.shortDisplayName || home.team.name || home.team.abbreviation,
    home_score: scoreOf(home),
    away_team: nbaTricode(away.team.abbreviation),
    away_team_name: away.team.shortDisplayName || away.team.name || away.team.abbreviation,
    away_score: scoreOf(away),
    arena: comp.venue?.fullName || "",
    arena_city: comp.venue?.address?.city || "",
    season: seasonFromEspnYear(year),
    source: "espn",
    game_type: gameType,
    playoff_round: gameType === "playoffs" ? playoffRound(comp.notes?.[0]?.headline) : null,
    updated_at: now,
  };
}

/* ─── Lecture ─── */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function teamIds(): Promise<string[]> {
  const data = await fetchEspnJson<{
    sports: { leagues: { teams: { team: { id: string } }[] }[] }[];
  }>(`${API}/teams`, { label: "équipes" });
  return data.sports[0].leagues[0].teams.map((t) => t.team.id);
}

/**
 * Tous les matchs d'une saison (`espnYear` : année de fin, 2027 pour 2026-27)
 * et d'un type, sans doublons.
 *
 * Trente appels, espacés : ESPN ne publie pas de limite, mais rien ne sert de
 * la chercher — on ne veut pas se faire fermer cette source-là aussi.
 */
export async function fetchSeasonGames(espnYear: number, seasonType: 2 | 3 | 5): Promise<GameRow[]> {
  const now = new Date().toISOString();
  const byId = new Map<string, GameRow>();

  for (const id of await teamIds()) {
    const data = await fetchEspnJson<{ events?: EspnEvent[] }>(
      `${API}/teams/${id}/schedule?season=${espnYear}&seasontype=${seasonType}`,
      { label: `calendrier de l'équipe ${id}` }
    );
    for (const event of data.events ?? []) {
      const row = toGameRow(event, now);
      if (row) byId.set(row.game_id, row);
    }
    await delay(250);
  }

  return [...byId.values()];
}

/**
 * Saison en cours selon ESPN (« 2026-27 »), ou `null` si ESPN est injoignable.
 * ESPN bascule sur la saison suivante dès sa présaison, fin septembre.
 */
export async function fetchEspnSeason(): Promise<string | null> {
  try {
    const data = await fetchEspnJson<{ leagues?: { season?: { year?: number } }[] }>(
      `${API}/scoreboard`,
      { label: "saison en cours", attempts: 2 }
    );
    const year = data.leagues?.[0]?.season?.year;
    return year ? seasonFromEspnYear(year) : null;
  } catch {
    return null;
  }
}

/**
 * Matchs d'une journée (date de New York, `YYYY-MM-DD`), scores à jour : une
 * seule requête, pour rafraîchir les scores sans relire toute la saison.
 */
export async function fetchDayGames(date: string): Promise<GameRow[]> {
  const now = new Date().toISOString();
  const data = await fetchEspnJson<{ events?: EspnEvent[] }>(
    `${API}/scoreboard?dates=${date.replaceAll("-", "")}`,
    { label: `scores du ${date}` }
  );
  return (data.events ?? []).map((e) => toGameRow(e, now)).filter((r): r is GameRow => r !== null);
}
