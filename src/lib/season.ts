/**
 * NBA season utilities.
 *
 * NBA calendar:
 *   - Regular season: ~October → April
 *   - Playoffs: ~April → June
 *   - Off-season: ~July → September
 *
 * Convention: "2025-26" means the season that started in October 2025.
 * From October onward → new season. Before October → still previous season.
 */

/** Returns the current NBA season string, e.g. "2025-26". */
export function getCurrentSeason(): string {
  const now = new Date();
  return seasonFromDate(now);
}

/** Derives the NBA season from any date. */
export function seasonFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12

  // Oct–Dec: new season starts this year
  // Jan–Sep: still the season that started last year
  const startYear = month >= 10 ? year : year - 1;
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${endYear.toString().padStart(2, "0")}`;
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
