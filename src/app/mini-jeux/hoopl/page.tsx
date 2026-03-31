import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import HooplGame from "@/components/HooplGame";

export const revalidate = 3600;

export default async function HooplPage() {
  const season = getCurrentSeason();
  const supabase = await createClient();

  // Fetch active players with stats from rosters
  const { data: players } = await supabase
    .from("rosters")
    .select("player_id, first_name, last_name, team_tricode, team_name, position, age, height, weight, college, country, draft_year, draft_round, draft_number, jersey_number, pts, reb, ast")
    .eq("season", season)
    .not("pts", "is", null)
    .gt("pts", 0);

  // Fetch conference mapping from standings
  const { data: standings } = await supabase
    .from("standings")
    .select("team_tricode, conference")
    .eq("season", season);

  const conferenceMap: Record<string, string> = {};
  for (const s of standings || []) {
    conferenceMap[s.team_tricode] = s.conference;
  }

  // Build player list with conference
  const hooplPlayers = (players || []).map((p) => ({
    id: p.player_id,
    name: `${p.first_name} ${p.last_name}`,
    team: p.team_tricode,
    teamName: p.team_name,
    conference: conferenceMap[p.team_tricode] || "",
    position: p.position || "",
    age: p.age || 0,
    height: p.height || "",
    country: p.country || "",
    jersey: p.jersey_number || "",
    draft: p.draft_year ? `${p.draft_year}` : "Undrafted",
    pts: Number(p.pts) || 0,
    reb: Number(p.reb) || 0,
    ast: Number(p.ast) || 0,
  }));

  return <HooplGame players={hooplPlayers} />;
}
