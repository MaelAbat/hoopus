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
    .select("game_id, game_date, status, status_text, home_team, home_team_name, home_score, away_team, away_team_name, away_score")
    .in("game_date", [dateStr, todayStr])
    .in("status", [2, 3]) // Live or Final only
    .order("game_date", { ascending: false })
    .order("status", { ascending: false }); // Live games first

  const games = data || [];

  if (games.length === 0) return null;

  return <ScoresTicker games={games} />;
}
