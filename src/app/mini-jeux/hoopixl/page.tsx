import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import HoopixlGame from "@/components/HoopixlGame";

export const revalidate = 3600;

export default async function HoopixlPage() {
  const season = getCurrentSeason();
  const supabase = await createClient();

  const { data: players } = await supabase
    .from("rosters")
    .select("player_id, first_name, last_name, team_tricode, team_name, position")
    .eq("season", season)
    .not("pts", "is", null)
    .gt("pts", 5); // Only recognizable players (5+ PPG)

  const hoopixlPlayers = (players || []).map((p) => ({
    id: p.player_id,
    name: `${p.first_name} ${p.last_name}`,
    team: p.team_tricode,
    teamName: p.team_name,
    position: p.position || "",
  }));

  return <HoopixlGame players={hoopixlPlayers} />;
}
