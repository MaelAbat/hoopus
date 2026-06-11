import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import HooplGame from "@/components/HooplGame";

export const revalidate = 3600;

export const metadata = {
  title: "Hoopl — Devine le joueur NBA du jour",
  description:
    "Hoopl : devine le joueur NBA du jour à partir de ses statistiques. Équipe, conférence, division, stats — chaque essai te rapproche. Le Wordle de la NBA, sur Hoopus.",
  alternates: { canonical: "/mini-jeux/hoopl" },
};

export default async function HooplPage() {
  const season = getCurrentSeason();
  const supabase = await createClient();

  // Fetch active players with stats from rosters
  const { data: players } = await supabase
    .from("rosters")
    .select("player_id, first_name, last_name, team_tricode, team_name, position, age, height, weight, college, country, draft_year, draft_round, draft_number, jersey_number, pts, reb, ast")
    .eq("season", season)
    .not("pts", "is", null)
    .gt("pts", 0)
    .order("player_id", { ascending: true });

  // Fetch conference mapping from standings
  const { data: standings } = await supabase
    .from("standings")
    .select("team_tricode, conference")
    .eq("season", season);

  const conferenceMap: Record<string, string> = {};
  for (const s of standings || []) {
    conferenceMap[s.team_tricode] = s.conference;
  }

  // NBA divisions (stable, rarely change)
  const DIVISION_MAP: Record<string, string> = {
    BOS: "Atlantic", BKN: "Atlantic", NYK: "Atlantic", PHI: "Atlantic", TOR: "Atlantic",
    CHI: "Central", CLE: "Central", DET: "Central", IND: "Central", MIL: "Central",
    ATL: "Southeast", CHA: "Southeast", MIA: "Southeast", ORL: "Southeast", WAS: "Southeast",
    DAL: "Southwest", HOU: "Southwest", MEM: "Southwest", NOP: "Southwest", SAS: "Southwest",
    DEN: "Northwest", MIN: "Northwest", OKC: "Northwest", POR: "Northwest", UTA: "Northwest",
    GSW: "Pacific", LAC: "Pacific", LAL: "Pacific", PHX: "Pacific", SAC: "Pacific",
  };

  // Build player list with conference + division
  const hooplPlayers = (players || []).map((p) => ({
    id: p.player_id,
    name: `${p.first_name} ${p.last_name}`,
    team: p.team_tricode,
    teamName: p.team_name,
    conference: conferenceMap[p.team_tricode] || "",
    division: DIVISION_MAP[p.team_tricode] || "",
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
