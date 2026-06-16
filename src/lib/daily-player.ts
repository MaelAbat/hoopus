// Deterministic daily player selection shared by Hoopl and Hoopixl.
//
// Each day, every player gets a deterministic score from a hash of the day and
// the player id (rendezvous hashing); the highest score is "the player of the
// day". On its own this is memoryless: nothing stops the same player from being
// picked two days running (~1/N chance). To avoid that we replay the day
// sequence from a fixed epoch with the SAME rule and exclude the previous
// `window` days' winners from each pick, guaranteeing no repeat within that
// window — without any database.
//
// The replay starts from a fixed EPOCH (not a sliding window) so every call
// produces the same global sequence; a sliding start would let independent
// per-day calls disagree on history and leak repeats. Cost is O(daysSinceEpoch
// × players) and runs once per mount inside a useMemo.
//
// Caveat: the replay uses today's player pool for past days too (no historical
// roster store). A repeat is therefore only theoretically possible across a
// roster change that reshuffles the pool — rare and harmless for a mini-game.

export function hashTwo(a: number, b: number): number {
  let h = a * 0x9e3779b9 + b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  return Math.abs(h);
}

// Packed YYYYMMDD integer for a date, in local time (matches the games' storage keys).
function packDaySeed(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const DAY_MS = 86_400_000;
const EPOCH = new Date(2025, 0, 1); // fixed sequence anchor (before the games launched)
const DEFAULT_WINDOW = 30; // no player repeats within this many days

// Highest-hashing player not in `excluded`, scanning linearly (O(n)).
function topPick<T extends { id: number }>(players: T[], seed: number, excluded: Set<number>): T {
  let best = players[0];
  let bestScore = -1;
  let fallback = players[0];
  let fallbackScore = -1;
  for (const p of players) {
    const score = hashTwo(seed, p.id);
    if (score > fallbackScore) { fallbackScore = score; fallback = p; }
    if (!excluded.has(p.id) && score > bestScore) { bestScore = score; best = p; }
  }
  // If everything was excluded (window >= pool), fall back to the raw winner.
  return bestScore < 0 ? fallback : best;
}

/**
 * Rank all players for `date`, highest hash first, with the winners of the
 * previous `window` days demoted to the bottom so today's top pick can't match
 * a recent one. Players are never dropped (the list stays complete for
 * fallbacks like Hoopixl's missing-photo skip).
 *
 * `seedOffset` distinguishes the games (Hoopl 0, Hoopixl 7777) so they don't
 * share the same daily player.
 */
export function getDailyRanking<T extends { id: number }>(
  players: T[],
  date: Date,
  seedOffset = 0,
  window = DEFAULT_WINDOW,
): T[] {
  if (players.length === 0) return [];
  const w = Math.min(window, players.length - 1);
  const days = Math.max(0, Math.round((date.getTime() - EPOCH.getTime()) / DAY_MS));
  const recent: number[] = []; // actual picks, oldest first

  // Replay every past day to build a consistent exclusion history.
  for (let k = 0; k < days; k++) {
    const seed = packDaySeed(new Date(EPOCH.getTime() + k * DAY_MS)) + seedOffset;
    recent.push(topPick(players, seed, new Set(recent.slice(-w))).id);
  }

  // Today: full deterministic ranking, with the last `w` winners demoted.
  // Use `date` directly so the seed exactly matches the game's own day.
  const seed = packDaySeed(date) + seedOffset;
  const excluded = new Set(recent.slice(-w));
  const ranked = [...players].sort((a, b) => hashTwo(seed, b.id) - hashTwo(seed, a.id));
  return [
    ...ranked.filter((p) => !excluded.has(p.id)),
    ...ranked.filter((p) => excluded.has(p.id)),
  ];
}
