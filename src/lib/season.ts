/**
 * NBA season utilities.
 *
 * NBA calendar:
 *   - Regular season: ~October → April
 *   - Playoffs: ~April → June
 *   - Off-season: ~July → September
 *
 * Convention: "2025-26" means the season that started in October 2025.
 *
 * IMPORTANT — la saison de la ligue ne se déduit PAS du calendrier. Dès que les
 * Finales sont jouées (juin), la ligue est dans la saison suivante : les trades,
 * signatures et salaires de l'intersaison appartiennent à la nouvelle saison,
 * pas à celle qui vient de finir. `seasonFromDate` n'est qu'un filet de
 * sécurité ; la source de vérité est la table `league_state`, lue via
 * `src/lib/league-season.ts`.
 */

/** Construit un libellé de saison depuis son année de départ. 2025 → "2025-26". */
export function seasonFromStartYear(startYear: number): string {
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${endYear.toString().padStart(2, "0")}`;
}

/**
 * Saison déduite du calendrier — filet de sécurité uniquement.
 *
 * Ne reflète pas la bascule réelle : entre la fin des Finales (juin) et le 1er
 * octobre, cette fonction renvoie encore la saison terminée. Utilisez
 * `getLeagueSeason()` pour toute écriture ou tout affichage de l'état courant.
 */
export function getCurrentSeason(): string {
  return seasonFromDate(new Date());
}

/** Derives the NBA season from any date. Calendar heuristic only. */
export function seasonFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12

  // Oct–Dec: new season starts this year
  // Jan–Sep: still the season that started last year
  return seasonFromStartYear(month >= 10 ? year : year - 1);
}

/** Two-digit suffix for CDN URLs, e.g. "2025-26" → "26". */
export function seasonSuffix(season: string): string {
  return season.split("-")[1];
}

/** Display label, e.g. "Saison 2025-26". */
export function seasonLabel(season: string): string {
  return `Saison ${season}`;
}

/** Returns the start year of a season, e.g. "2025-26" → 2025. */
export function seasonStartYear(season: string): number {
  return parseInt(season.split("-")[0], 10);
}

/** Saison suivante. "2025-26" → "2026-27". */
export function seasonAfter(season: string): string {
  return seasonFromStartYear(seasonStartYear(season) + 1);
}

/** Saison précédente. "2025-26" → "2024-25". */
export function seasonBefore(season: string): string {
  return seasonFromStartYear(seasonStartYear(season) - 1);
}

/** Vrai si `a` est postérieure à `b`. */
export function isSeasonAfter(a: string, b: string): boolean {
  return seasonStartYear(a) > seasonStartYear(b);
}

/** La plus récente d'une liste de saisons (les valeurs vides sont ignorées). */
export function latestSeason(...seasons: (string | null | undefined)[]): string | null {
  const valid = seasons.filter(
    (s): s is string => !!s && Number.isFinite(seasonStartYear(s))
  );
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (seasonStartYear(b) > seasonStartYear(a) ? b : a));
}

/**
 * Saison encodée dans un identifiant de match NBA.
 *
 * Format sur 10 chiffres : `PPPYYNNNNN`, où PPP est le type (001 présaison,
 * 002 saison régulière, 003 All-Star, 004 playoffs, 005 play-in) et YY les deux
 * derniers chiffres de l'année de départ. `0042500407` → "2025-26".
 *
 * C'est la seule façon fiable d'étiqueter un match : le calendrier du CDN NBA
 * bascule sur la saison suivante pendant l'intersaison, et étiqueter son
 * contenu avec une saison calculée à part y verse les matchs de l'année N+1.
 */
export function seasonFromGameId(gameId: string): string | null {
  if (!/^\d{10}$/.test(gameId)) return null;
  const yy = Number(gameId.slice(3, 5));
  if (!Number.isFinite(yy)) return null;
  // La première saison NBA date de 1946 : au-delà de 46, on est au XXe siècle.
  return seasonFromStartYear(yy >= 46 ? 1900 + yy : 2000 + yy);
}

/** Type de match encodé dans l'identifiant NBA. */
export function gameTypeFromGameId(
  gameId: string
): "preseason" | "regular" | "allstar" | "playoffs" | "playin" | null {
  if (!/^\d{10}$/.test(gameId)) return null;
  switch (gameId.slice(0, 3)) {
    case "001": return "preseason";
    case "002": return "regular";
    case "003": return "allstar";
    case "004": return "playoffs";
    case "005": return "playin";
    default: return null;
  }
}

export interface LeagueSeasonSignals {
  /** Règle calendaire — borne de sécurité. */
  calendarSeason: string;
  /** `leagueSchedule.seasonYear` du CDN NBA, s'il a pu être lu. */
  scheduleSeason?: string | null;
  /** Saison dont les Finales sont jouées, si elle est connue. */
  finalsCompletedSeason?: string | null;
}

/**
 * Résout la saison courante de la ligue à partir des signaux disponibles.
 *
 * On retient le plus avancé des signaux — une saison n'a jamais de raison de
 * reculer — puis on borne le résultat à une saison au-delà du calendrier. Cette
 * borne limite les dégâts si un signal se corrompt : au pire on avance d'un an
 * trop tôt, jamais de plusieurs.
 */
export function resolveLeagueSeason({
  calendarSeason,
  scheduleSeason,
  finalsCompletedSeason,
}: LeagueSeasonSignals): string {
  const afterFinals = finalsCompletedSeason ? seasonAfter(finalsCompletedSeason) : null;
  const candidate =
    latestSeason(calendarSeason, scheduleSeason, afterFinals) ?? calendarSeason;

  const ceiling = seasonAfter(calendarSeason);
  return isSeasonAfter(candidate, ceiling) ? ceiling : candidate;
}

/* ─── Statut d'une saison ─── */

export type SeasonStatus = "upcoming" | "current" | "completed";

/** Libellé court d'un statut, pour les listes déroulantes et les bandeaux. */
export function seasonStatusLabel(status: SeasonStatus): string {
  switch (status) {
    case "upcoming":
      return "à venir";
    case "current":
      return "en cours";
    case "completed":
      return "terminée";
  }
}

/**
 * Situe une saison par rapport à l'état de la ligue.
 *
 * Une saison postérieure à la dernière saison jouée n'a pas commencé. Celle qui
 * porte les matchs les plus récents est « en cours » seulement si la ligue s'y
 * trouve encore : après les Finales, elle devient « terminée » alors que la
 * ligue est déjà passée à la suivante.
 */
export function seasonStatus(
  season: string,
  state: { currentSeason: string; statsSeason: string }
): SeasonStatus {
  if (isSeasonAfter(season, state.statsSeason)) return "upcoming";
  if (season === state.statsSeason && season === state.currentSeason) return "current";
  return "completed";
}

/**
 * Liste de saisons pour un sélecteur : dédoublonnée et triée de la plus récente
 * à la plus ancienne.
 *
 * Les saisons supplémentaires permettent d'ajouter la saison de la ligue même
 * quand elle n'a encore aucune donnée — sans quoi elle n'apparaîtrait dans aucun
 * menu jusqu'au premier match.
 */
export function buildSeasonOptions(
  available: (string | null | undefined)[],
  ...extra: (string | null | undefined)[]
): string[] {
  const set = new Set<string>();
  for (const s of [...available, ...extra]) {
    if (s && Number.isFinite(seasonStartYear(s))) set.add(s);
  }
  return [...set].sort((a, b) => seasonStartYear(b) - seasonStartYear(a));
}
