/**
 * Équipes côté ESPN.
 *
 * ESPN abrège six équipes autrement que la NBA (« GS » pour Golden State,
 * « UTAH » pour Utah…). Le site range tout par tricode NBA : toute donnée ESPN
 * passe par `nbaTricode` avant d'être écrite.
 */

const ESPN_TRICODE_MAP: Record<string, string> = {
  GS: "GSW",
  NY: "NYK",
  SA: "SAS",
  NO: "NOP",
  WSH: "WAS",
  UTAH: "UTA",
};

export function nbaTricode(espn: string): string {
  return ESPN_TRICODE_MAP[espn.toUpperCase()] || espn.toUpperCase();
}

/** Préfixe des identifiants de match ESPN, pour ne jamais les confondre avec ceux de la NBA. */
export const ESPN_GAME_PREFIX = "E";

export function espnGameId(eventId: string): string {
  return `${ESPN_GAME_PREFIX}${eventId}`;
}

export function isEspnGameId(gameId: string): boolean {
  return gameId.startsWith(ESPN_GAME_PREFIX);
}

/** Identifiant ESPN d'origine, ou `null` pour un match NBA. */
export function espnEventId(gameId: string): string | null {
  return isEspnGameId(gameId) ? gameId.slice(ESPN_GAME_PREFIX.length) : null;
}

/** Saison au format du site (« 2026-27 ») depuis l'année ESPN, qui désigne l'année de fin (2027). */
export function seasonFromEspnYear(year: number): string {
  return `${year - 1}-${String(year % 100).padStart(2, "0")}`;
}
