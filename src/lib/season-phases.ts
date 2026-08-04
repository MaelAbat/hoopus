/**
 * Périodes d'une saison NBA.
 *
 * Une saison NBA se lit en sept temps : loterie, draft, ouverture de la free
 * agency, saison régulière, date limite des échanges, marché des rachats de
 * contrat, playoffs. Ce module donne leurs dates, sait dans quelle période tombe
 * un jour donné, et à quelle saison rattacher un mouvement.
 *
 * Aucune source ne publie ces dates. Elles sont donc estimées d'après les usages
 * de la ligue, marquées comme telles, et corrigeables par un UPDATE dans
 * `season_phases` (voir la migration 042). Une estimation vaut mieux qu'un blanc :
 * dire « début février » d'une date limite est juste, et le drapeau `isEstimated`
 * empêche de la présenter comme officielle.
 *
 * Toutes les périodes d'une saison portant l'année de départ Y :
 *
 *   loterie          mi-mai Y            (détermine la draft qui suit)
 *   draft            fin juin Y
 *   free agency      30 juin Y → veille du premier match
 *   saison régulière fin octobre Y → mi-avril Y+1
 *   date limite      début février Y+1
 *   marché rachats   date limite → 1er mars Y+1
 *   playoffs         mi-avril Y+1 → mi-juin Y+1
 */

import { seasonFromStartYear, seasonStartYear } from "./season";

export type PhaseKey =
  | "lottery"
  | "draft"
  | "free_agency"
  | "regular_season"
  | "trade_deadline"
  | "buyout_market"
  | "playoffs";

export interface SeasonPhase {
  season: string;
  phase: PhaseKey;
  startsOn: string;
  /** Fin de la fenêtre. Égale à `startsOn` pour un repère ponctuel. */
  endsOn: string;
  isEstimated: boolean;
}

/** Libellés d'affichage, du plus court au plus explicite. */
export const PHASE_LABELS: Record<PhaseKey, string> = {
  lottery: "Loterie",
  draft: "Draft",
  free_agency: "Free agency",
  regular_season: "Saison régulière",
  trade_deadline: "Date limite des échanges",
  buyout_market: "Marché des rachats",
  playoffs: "Playoffs",
};

/** Une phrase qui situe la période, pour les bandeaux et les infobulles. */
export const PHASE_DESCRIPTIONS: Record<PhaseKey, string> = {
  lottery: "Le tirage qui fixe l'ordre des quatorze premiers choix de la draft.",
  draft: "Les deux tours de sélection des nouveaux joueurs.",
  free_agency: "Les agents libres signent où ils veulent.",
  regular_season: "Quatre-vingt-deux matchs, et les échanges qui les accompagnent.",
  trade_deadline: "Dernier jour pour échanger un joueur.",
  buyout_market: "Les joueurs coupés cherchent une équipe avant les playoffs.",
  playoffs: "Les effectifs sont figés, place au jeu.",
};

/** Ordre chronologique dans une saison, pour l'affichage en frise. */
export const PHASE_ORDER: PhaseKey[] = [
  "lottery",
  "draft",
  "free_agency",
  "regular_season",
  "trade_deadline",
  "buyout_market",
  "playoffs",
];

/* ─── Utilitaires de dates ─── */

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * N-ième jour de semaine d'un mois. `nthWeekday(2025, 6, 4, 4)` donne le
 * quatrième jeudi de juin 2025. Jour de semaine au format JS : 0 dimanche.
 */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (weekday - first + 7) % 7;
  return 1 + offset + (n - 1) * 7;
}

/**
 * La free agency s'ouvre le 30 juin depuis la convention 2023, le 1er juillet
 * avant. Deux dates différentes pour un même moment de l'année.
 */
const FREE_AGENCY_JUNE_30_FROM = 2023;

/**
 * Dates estimées des périodes d'une saison, d'après les usages de la ligue.
 *
 * Les règles retenues, chacune vérifiable sur les dernières années :
 * loterie le deuxième mardi de mai, draft le quatrième jeudi de juin, saison
 * régulière du troisième mardi d'octobre au deuxième dimanche d'avril, date
 * limite le premier jeudi de février, playoffs du troisième samedi d'avril à
 * la mi-juin.
 */
export function estimateSeasonPhases(season: string): SeasonPhase[] {
  const y = seasonStartYear(season);
  const next = y + 1;

  const lottery = iso(y, 5, nthWeekday(y, 5, 2, 2));
  const draft = iso(y, 6, nthWeekday(y, 6, 4, 4));
  const faStart = y >= FREE_AGENCY_JUNE_30_FROM ? iso(y, 6, 30) : iso(y, 7, 1);
  const seasonStart = iso(y, 10, nthWeekday(y, 10, 2, 3));
  const seasonEnd = iso(next, 4, nthWeekday(next, 4, 0, 2));
  const deadline = iso(next, 2, nthWeekday(next, 2, 4, 1));
  const playoffsStart = iso(next, 4, nthWeekday(next, 4, 6, 3));
  const playoffsEnd = iso(next, 6, 20);

  const phase = (p: PhaseKey, startsOn: string, endsOn = startsOn): SeasonPhase => ({
    season,
    phase: p,
    startsOn,
    endsOn,
    isEstimated: true,
  });

  return [
    phase("lottery", lottery),
    phase("draft", draft),
    // La free agency reste ouverte tout l'été : elle se referme la veille du
    // premier match, quand les effectifs se figent pour de bon.
    phase("free_agency", faStart, iso(y, 10, nthWeekday(y, 10, 2, 3) - 1)),
    phase("regular_season", seasonStart, seasonEnd),
    phase("trade_deadline", deadline),
    // Fenêtre des rachats : de la date limite au 1er mars, dernier jour pour
    // signer un joueur et le rendre qualifiable pour les playoffs.
    phase("buyout_market", deadline, iso(next, 3, 1)),
    phase("playoffs", playoffsStart, playoffsEnd),
  ];
}

/**
 * Saison à laquelle rattacher un mouvement.
 *
 * La règle de la ligue, déjà appliquée aux effectifs et aux salaires : ce qui se
 * passe après les Finales appartient à la saison qui s'ouvre. Une signature du
 * 2 juillet 2025 est une signature 2025-26, pas 2024-25.
 *
 * La bascule est posée au 20 juin, juste après les Finales et juste avant la
 * draft. Approximation assumée : les Finales se terminent entre le 12 et le
 * 23 juin selon les années, et un échange conclu pendant les Finales est de
 * toute façon un échange d'intersaison.
 */
export function seasonForEventDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const startsNewSeason = month >= 7 || (month === 6 && day >= 20);
  return seasonFromStartYear(startsNewSeason ? year : year - 1);
}

/**
 * Période dans laquelle tombe une date, parmi les périodes fournies.
 *
 * Les repères ponctuels (draft, loterie, date limite) gagnent sur les fenêtres
 * qui les englobent : un échange conclu le jour de la date limite est un échange
 * de la date limite, pas un échange de saison régulière.
 */
export function phaseForDate(date: string, phases: SeasonPhase[]): PhaseKey | null {
  const inside = phases.filter((p) => date >= p.startsOn && date <= p.endsOn);
  if (inside.length === 0) return null;
  const exact = inside.find((p) => p.startsOn === p.endsOn);
  if (exact) return exact.phase;
  // Fenêtre la plus courte : le marché des rachats est plus précis que la
  // saison régulière qui le contient.
  return inside.sort(
    (a, b) => span(a) - span(b) || PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase)
  )[0].phase;
}

function span(p: SeasonPhase): number {
  return new Date(p.endsOn).getTime() - new Date(p.startsOn).getTime();
}

/** Format court d'une date de période : « 26 juin 2025 ». */
export function formatPhaseDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
