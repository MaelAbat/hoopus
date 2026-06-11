import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import HoopixlGame from "@/components/HoopixlGame";
import { OG_IMAGE } from "@/lib/seo";

export const revalidate = 3600;

const description =
  "Hoopixl : une photo pixelisée de joueur NBA se révèle peu à peu. Reconnais-le avant que l'image ne devienne nette. Le défi photo quotidien de Hoopus.";

export const metadata = {
  title: "Hoopixl — Devine le joueur NBA pixelisé",
  description,
  alternates: { canonical: "/mini-jeux/hoopixl" },
  openGraph: { title: "Hoopixl — Devine le joueur NBA pixelisé · Hoopus", description, images: [OG_IMAGE] },
};

export default async function HoopixlPage() {
  const season = getCurrentSeason();
  const supabase = await createClient();

  const { data: players } = await supabase
    .from("rosters")
    .select("player_id, first_name, last_name, team_tricode, team_name, position")
    .eq("season", season)
    .not("pts", "is", null)
    .gt("pts", 5) // Only recognizable players (5+ PPG)
    .order("player_id", { ascending: true });

  const hoopixlPlayers = (players || []).map((p) => ({
    id: p.player_id,
    name: `${p.first_name} ${p.last_name}`,
    team: p.team_tricode,
    teamName: p.team_name,
    position: p.position || "",
  }));

  return <HoopixlGame players={hoopixlPlayers} />;
}
