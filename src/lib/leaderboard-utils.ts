export interface LeaderboardItem<T> {
  type: "entry";
  entry: T;
  rank: number;
  isUser: boolean;
}

export interface LeaderboardSeparator {
  type: "separator";
}

export type LeaderboardRow<T> = LeaderboardItem<T> | LeaderboardSeparator;

/**
 * Computes the visible leaderboard entries:
 * - If ≤ 10 entries or user not found beyond top: show top 10
 * - If user is beyond top 5: show top 5 + "..." separator + entries around user
 */
export function computeVisibleLeaderboard<T extends { user_id: string }>(
  entries: T[],
  userId: string | null,
): LeaderboardRow<T>[] {
  const TOP = 5;
  const CONTEXT = 1; // entries above and below user

  const toItem = (entry: T, index: number): LeaderboardItem<T> => ({
    type: "entry",
    entry,
    rank: index + 1,
    isUser: entry.user_id === userId,
  });

  // Small leaderboard — show everything
  if (entries.length <= 10) {
    return entries.map(toItem);
  }

  const userIdx = userId ? entries.findIndex((e) => e.user_id === userId) : -1;

  // User not found or not logged in — just show top 10
  if (userIdx < 0) {
    return entries.slice(0, 10).map(toItem);
  }

  // User is within or adjacent to top section — show continuous range
  const contextStart = Math.max(TOP, userIdx - CONTEXT);
  const contextEnd = Math.min(entries.length, userIdx + CONTEXT + 1);

  if (contextStart <= TOP) {
    return entries.slice(0, Math.max(contextEnd, TOP)).map(toItem);
  }

  // User is far below — top 5 + separator + context around user
  const result: LeaderboardRow<T>[] = [];

  for (let i = 0; i < TOP; i++) {
    result.push(toItem(entries[i], i));
  }

  result.push({ type: "separator" });

  for (let i = contextStart; i < contextEnd; i++) {
    result.push(toItem(entries[i], i));
  }

  return result;
}
