import { createClient } from "@/lib/supabase/server";
import ScoresTicker from "./ScoresTicker";

export default async function ScoresTickerServer() {
  const supabase = await createClient();

  // Get yesterday's date (ET timezone — NBA games are in ET)
  const now = new Date();
  // Approximate ET: UTC-5 (close enough for date calculation)
  const et = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const yesterday = new Date(et);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  // Also check today in case games just finished
  const todayStr = et.toISOString().slice(0, 10);

  // Fetch yesterday's and today's finished/live games
  const { data } = await supabase
    .from("games")
    .select("game_id, game_date, status, status_text, home_team, home_team_name, home_score, away_team, away_team_name, away_score, game_time")
    .in("game_date", [dateStr, todayStr])
    .in("status", [2, 3]) // Live or Final only
    .order("game_date", { ascending: false })
    .order("status", { ascending: false }); // Live games first

  const results = data || [];

  // Also fetch upcoming games for today/tomorrow
  const tomorrow = new Date(et);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const { data: upcomingRaw } = await supabase
    .from("games")
    .select("game_id, game_date, status, status_text, home_team, home_team_name, home_score, away_team, away_team_name, away_score, game_time")
    .in("game_date", [todayStr, tomorrowStr])
    .eq("status", 1) // Scheduled only
    .order("game_date", { ascending: true })
    .order("game_time", { ascending: true })
    .limit(50);

  // Keep only the first date that has upcoming games
  const firstUpcomingDate = upcomingRaw?.[0]?.game_date;
  const upcoming = firstUpcomingDate
    ? upcomingRaw!.filter(g => g.game_date === firstUpcomingDate)
    : [];

  // Show both results and upcoming if both exist
  if (results.length > 0 && upcoming.length > 0) {
    return (
      <div className="space-y-2">
        <ScoresTicker games={results} mode="results" />
        <ScoresTicker games={upcoming} mode="upcoming" />
      </div>
    );
  }

  if (results.length > 0) {
    return <ScoresTicker games={results} mode="results" />;
  }

  if (upcoming.length > 0) {
    return <ScoresTicker games={upcoming} mode="upcoming" />;
  }

  // No results and no upcoming today — fetch the next day that has games
  const { data: futureRaw } = await supabase
    .from("games")
    .select("game_id, game_date, status, status_text, home_team, home_team_name, home_score, away_team, away_team_name, away_score, game_time")
    .gt("game_date", tomorrowStr)
    .eq("status", 1)
    .order("game_date", { ascending: true })
    .order("game_time", { ascending: true })
    .limit(50);

  const firstFutureDate = futureRaw?.[0]?.game_date;
  const futureGames = firstFutureDate
    ? futureRaw!.filter(g => g.game_date === firstFutureDate)
    : [];

  if (futureGames.length === 0) return null;

  return <ScoresTicker games={futureGames} mode="upcoming" />;
}
