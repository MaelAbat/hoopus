import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import HoopMoreGame from "@/components/HoopMoreGame";

export const revalidate = 3600;

export default async function HoopMorePage() {
  const season = getCurrentSeason();
  const supabase = await createClient();

  const { data: players } = await supabase
    .from("rosters")
    .select("player_id, first_name, last_name, team_tricode, team_name, pts, reb, ast, age, salary")
    .eq("season", season)
    .not("pts", "is", null)
    .gt("pts", 5)
    .order("player_id", { ascending: true });

  const hoopMorePlayers = (players || []).map((p) => {
    const sal = p.salary != null ? Number(p.salary) : null;
    return {
      id: p.player_id,
      name: `${p.first_name} ${p.last_name}`,
      team: p.team_tricode,
      teamName: p.team_name,
      pts: Number(p.pts) || 0,
      reb: Number(p.reb) || 0,
      ast: Number(p.ast) || 0,
      age: p.age || 0,
      salary: sal != null && !isNaN(sal) && sal > 0 ? sal : null,
    };
  });

  return <HoopMoreGame players={hoopMorePlayers} />;
}
