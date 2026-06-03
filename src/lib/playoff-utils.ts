/*
  Helpers to hide playoff games that will never be played.

  When a best-of-7 series ends before game 7 (4-0, 4-1 or 4-2), the remaining
  "scheduled" games still exist in the data but will never happen. These helpers
  identify those games so the calendar and the score ticker can drop them.

  NBA playoff gameId format: "004XXYYZZ" — chars [6..8] encode the round
  (01=first round, 02=conf semis, 03=conf finals, 04=finals).
*/

/** Round number from an NBA playoff gameId, or null if it is not a playoff game. */
export function playoffRoundFromGameId(gameId: string): number | null {
  if (!gameId.startsWith("004")) return null;
  const round = parseInt(gameId.substring(6, 8), 10);
  return Number.isNaN(round) ? null : round;
}

/** Stable key for a playoff series: round + alphabetically-sorted team pair. */
export function playoffSeriesKey(round: number, teamA: string, teamB: string): string {
  return `${round}-${[teamA, teamB].sort().join("-")}`;
}

interface MinimalGame {
  game_id: string;
  status: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
}

/**
 * Series keys that are already decided (one team reached 4 wins), computed from
 * the finished games (status 3) present in the provided list. Requires the list
 * to contain the full set of played games for those series.
 */
export function decidedSeriesKeysFromGames(games: MinimalGame[]): Set<string> {
  const wins = new Map<string, Record<string, number>>();
  for (const g of games) {
    const round = playoffRoundFromGameId(g.game_id);
    if (round === null || g.status !== 3) continue; // only finished playoff games count
    const key = playoffSeriesKey(round, g.home_team, g.away_team);
    const winner = g.home_score > g.away_score ? g.home_team : g.away_team;
    const rec = wins.get(key) ?? {};
    rec[winner] = (rec[winner] ?? 0) + 1;
    wins.set(key, rec);
  }
  const decided = new Set<string>();
  for (const [key, rec] of wins) {
    if (Object.values(rec).some((w) => w >= 4)) decided.add(key);
  }
  return decided;
}

interface MinimalSeries {
  round: number;
  team_top: string;
  team_bottom: string;
  wins_top: number;
  wins_bottom: number;
  status?: string;
}

/** Series keys that are already decided, computed from playoff_series rows. */
export function decidedSeriesKeysFromSeries(series: MinimalSeries[]): Set<string> {
  const decided = new Set<string>();
  for (const s of series) {
    if (s.status === "completed" || s.wins_top >= 4 || s.wins_bottom >= 4) {
      decided.add(playoffSeriesKey(s.round, s.team_top, s.team_bottom));
    }
  }
  return decided;
}

/** Drop scheduled (status 1) games whose series key is in `decided`. Everything else passes through. */
export function filterScheduledByDecidedSeries<
  T extends { game_id: string; status: number; home_team: string; away_team: string }
>(games: T[], decided: Set<string>): T[] {
  if (decided.size === 0) return games;
  return games.filter((g) => {
    if (g.status !== 1) return true; // keep played / live games
    const round = playoffRoundFromGameId(g.game_id);
    if (round === null) return true; // not a playoff game
    return !decided.has(playoffSeriesKey(round, g.home_team, g.away_team));
  });
}

/**
 * Remove scheduled playoff games whose series is already decided, deriving the
 * decided series from the finished games in the same list. Self-contained — use
 * when the list already holds every played game for the relevant series.
 */
export function hideSettledPlayoffGames<T extends MinimalGame>(games: T[]): T[] {
  return filterScheduledByDecidedSeries(games, decidedSeriesKeysFromGames(games));
}
