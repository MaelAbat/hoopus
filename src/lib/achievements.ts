import { createClient } from "@/lib/supabase/client";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
}

export interface UserAchievement {
  achievement_id: string;
  unlocked_at: string;
}

/** All score tables and how to extract wins / relevant data from each. */
const SCORE_TABLES = [
  { table: "hoopl_scores", dateField: "game_date", wonField: "won", guessesField: "guesses" },
  { table: "hoopixl_scores", dateField: "game_date", wonField: "won", guessesField: "guesses" },
  { table: "hoopgrid_scores", dateField: "game_date", wonField: "won", guessesField: null },
  { table: "hooplink_scores", dateField: "game_date", wonField: "won", guessesField: null },
  { table: "hoopmore_scores", dateField: "game_date", wonField: null, guessesField: null },
  { table: "hooprank_scores", dateField: "game_date", wonField: null, guessesField: null },
  { table: "quiz_scores", dateField: "created_at", wonField: "won", guessesField: null },
] as const;

/**
 * Checks a user's stats across all game tables and unlocks any new achievements.
 * Returns the list of newly unlocked achievements (empty if none).
 */
export async function checkAchievements(userId: string): Promise<Achievement[]> {
  const supabase = createClient();

  // 1. Fetch all achievement definitions
  const { data: allAchievements } = await supabase
    .from("achievements")
    .select("*");

  if (!allAchievements || allAchievements.length === 0) return [];

  // 2. Fetch already-unlocked achievements for this user
  const { data: existingUnlocks } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);

  const unlockedSet = new Set(
    (existingUnlocks || []).map((u) => u.achievement_id)
  );

  // 3. Gather stats from all score tables
  let totalWins = 0;
  let fastestTime = Infinity;
  let hooplFirstGuess = false;
  const winDates = new Set<string>(); // dates with at least one win
  const playDates = new Set<string>(); // dates with any play
  const todayGames = new Set<string>(); // games played today

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const distinctGames = new Set<string>();

  await Promise.all(
    SCORE_TABLES.map(async ({ table, dateField, wonField, guessesField }) => {
      const selectFields = [dateField, "time_seconds"];
      if (wonField) selectFields.push(wonField);
      if (guessesField) selectFields.push(guessesField);

      const { data: rows } = await supabase
        .from(table)
        .select(selectFields.join(", "))
        .eq("user_id", userId)
        .order(dateField, { ascending: true });

      if (!rows || rows.length === 0) return;

      for (const row of rows) {
        const r = row as unknown as Record<string, unknown>;
        // Normalize date: game_date is "YYYY-M-D", created_at is ISO timestamp
        const rawDate = r[dateField] as string;
        let gameDate: string;
        if (dateField === "created_at") {
          const d = new Date(rawDate);
          gameDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        } else {
          gameDate = rawDate;
        }

        playDates.add(gameDate);

        // Track distinct game types
        distinctGames.add(table);

        // Check if played today
        if (gameDate === todayStr) {
          todayGames.add(table);
        }

        // Count wins (for tables with a 'won' field, use it; otherwise every play counts)
        const didWin = wonField ? !!r[wonField] : true;
        if (didWin) {
          totalWins++;
          winDates.add(gameDate);

          // Track fastest time across all winning games
          const time = r["time_seconds"] as number;
          if (time < fastestTime) {
            fastestTime = time;
          }
        }

        // Check perfect Hoopl (first guess win)
        if (table === "hoopl_scores" && guessesField) {
          const guesses = r[guessesField] as number;
          const won = r[wonField!] as boolean;
          if (won && guesses === 1) {
            hooplFirstGuess = true;
          }
        }
      }
    })
  );

  // 4. Calculate win streak (consecutive days with at least one win)
  const sortedWinDates = Array.from(winDates).sort();
  let maxStreak = 0;
  let currentStreak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of sortedWinDates) {
    const parts = dateStr.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);

    if (prevDate) {
      const diffMs = d.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }

    if (currentStreak > maxStreak) {
      maxStreak = currentStreak;
    }
    prevDate = d;
  }

  // 5. Determine which achievements to unlock
  const newlyUnlocked: Achievement[] = [];

  for (const achievement of allAchievements as Achievement[]) {
    if (unlockedSet.has(achievement.id)) continue;

    let shouldUnlock = false;

    switch (achievement.id) {
      case "first_win":
        shouldUnlock = totalWins >= 1;
        break;
      case "win_5":
        shouldUnlock = totalWins >= 5;
        break;
      case "win_25":
        shouldUnlock = totalWins >= 25;
        break;
      case "win_100":
        shouldUnlock = totalWins >= 100;
        break;
      case "streak_3":
        shouldUnlock = maxStreak >= 3;
        break;
      case "streak_7":
        shouldUnlock = maxStreak >= 7;
        break;
      case "streak_30":
        shouldUnlock = maxStreak >= 30;
        break;
      case "speed_demon":
        shouldUnlock = fastestTime < 30;
        break;
      case "perfect_hoopl":
        shouldUnlock = hooplFirstGuess;
        break;
      case "all_games":
        shouldUnlock = todayGames.size >= 7;
        break;
      case "explorer":
        shouldUnlock = distinctGames.size >= 3;
        break;
      case "dedicated":
        shouldUnlock = playDates.size >= 10;
        break;
    }

    if (shouldUnlock) {
      newlyUnlocked.push(achievement);
    }
  }

  // 6. Insert newly unlocked achievements
  if (newlyUnlocked.length > 0) {
    const inserts = newlyUnlocked.map((a) => ({
      user_id: userId,
      achievement_id: a.id,
    }));

    await supabase.from("user_achievements").insert(inserts);
  }

  return newlyUnlocked;
}

/**
 * Fetch all achievements with unlock status for a given user.
 */
export async function fetchAllAchievements(
  userId: string | null
): Promise<{ achievement: Achievement; unlocked: boolean; unlockedAt: string | null }[]> {
  const supabase = createClient();

  const { data: allAchievements } = await supabase
    .from("achievements")
    .select("*")
    .order("category")
    .order("threshold");

  if (!allAchievements) return [];

  const unlockedMap = new Map<string, string>();

  if (userId) {
    const { data: userAchievements } = await supabase
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", userId);

    for (const ua of userAchievements || []) {
      unlockedMap.set(ua.achievement_id, ua.unlocked_at);
    }
  }

  return (allAchievements as Achievement[]).map((a) => ({
    achievement: a,
    unlocked: unlockedMap.has(a.id),
    unlockedAt: unlockedMap.get(a.id) || null,
  }));
}
