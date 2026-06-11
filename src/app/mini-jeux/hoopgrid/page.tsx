import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import HoopGridGame from "@/components/HoopGridGame";

export const revalidate = 3600;

export const metadata = {
  title: "HoopGrid — Mots mêlés NBA",
  description:
    "HoopGrid, le jeu de mots mêlés NBA : barre les noms cachés dans la grille pour révéler le joueur mystère. Un puzzle quotidien à résoudre sur Hoopus.",
  alternates: { canonical: "/mini-jeux/hoopgrid" },
};

export default async function HoopGridPage() {
  const season = getCurrentSeason();
  const supabase = await createClient();

  const { data: players } = await supabase
    .from("rosters")
    .select("player_id, last_name, team_tricode")
    .eq("season", season)
    .not("last_name", "is", null)
    .order("player_id", { ascending: true });

  // Build unique last names with at least 3 characters, ASCII-friendly
  const seen = new Set<string>();
  const names: { name: string; team: string }[] = [];
  for (const p of players || []) {
    const raw = p.last_name?.trim();
    if (!raw || raw.length < 3) continue;
    // Keep only A-Z names (no hyphens, spaces, accents)
    const clean = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    if (!/^[A-Z]+$/.test(clean) || clean.length < 3 || clean.length > 12) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    names.push({ name: clean, team: p.team_tricode });
  }

  return <HoopGridGame allNames={names} />;
}
