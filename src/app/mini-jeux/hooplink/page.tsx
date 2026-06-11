import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import HoopLinkGame from "@/components/HoopLinkGame";
import type { HoopLinkPlayer, PlayerTeamsMap, AdjacencyList } from "@/components/HoopLinkGame";

export const revalidate = 3600;

export const metadata = {
  title: "HoopLink — Relie deux joueurs NBA",
  description:
    "HoopLink : deux joueurs, un défi. Trouve le chemin le plus court en nommant des coéquipiers communs, maillon après maillon. Le jeu de connexions NBA de Hoopus.",
  alternates: { canonical: "/mini-jeux/hooplink" },
};

export default async function HoopLinkPage() {
  const season = getCurrentSeason();
  const supabase = await createClient();

  // 1. Current roster for player display + autocomplete
  const { data: currentRosterRows } = await supabase
    .from("rosters")
    .select("player_id, first_name, last_name, team_tricode, team_name")
    .eq("season", season)
    .not("first_name", "is", null)
    .order("player_id", { ascending: true });

  const rosterPlayers: HoopLinkPlayer[] = (currentRosterRows || []).map((p) => ({
    id: p.player_id,
    name: `${p.first_name} ${p.last_name}`,
    team: p.team_tricode,
    teamName: p.team_name,
    season,
  }));

  const rosterIds = new Set(rosterPlayers.map((p) => p.id));

  // 2. Build connections from TWO sources (rosters = guaranteed, career_stats = enrichment)
  // Supabase caps at 1000 rows per request regardless of .limit(), so we MUST paginate
  const allEntries: { player_id: number; season: string; team: string }[] = [];

  // Source A: rosters table (ALL seasons available, not just current)
  {
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from("rosters")
        .select("player_id, season, team_tricode")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (rosterIds.has(row.player_id)) {
          allEntries.push({ player_id: row.player_id, season: row.season, team: row.team_tricode });
        }
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  }

  // Source B: player_career_stats (all seasons including current — needed for mid-season trades)
  {
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from("player_career_stats")
        .select("player_id, season, team")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (rosterIds.has(row.player_id)) {
          allEntries.push({ player_id: row.player_id, season: row.season, team: row.team });
        }
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  }

  // 3. GUARANTEE: every current roster player has their current team entry
  //    This ensures same-team connections always work regardless of career_stats quality
  for (const p of rosterPlayers) {
    allEntries.push({ player_id: p.id, season, team: p.team });
  }

  // 4. Build playerTeams map (for client-side validation)
  const playerTeams: PlayerTeamsMap = {};
  const seen = new Set<string>();
  for (const e of allEntries) {
    const dedupKey = `${e.player_id}|${e.season}|${e.team}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    if (!playerTeams[e.player_id]) playerTeams[e.player_id] = [];
    playerTeams[e.player_id].push(`${e.season}|${e.team}`);
  }

  // 5. Build adjacency graph: group by (season, team), connect all players in each group
  const teamGroups = new Map<string, Set<number>>();
  for (const e of allEntries) {
    const key = `${e.season}|${e.team}`;
    if (!teamGroups.has(key)) teamGroups.set(key, new Set());
    teamGroups.get(key)!.add(e.player_id);
  }

  const adjacency = new Map<number, Set<number>>();
  for (const [, group] of teamGroups) {
    const ids = [...group];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!adjacency.has(ids[i])) adjacency.set(ids[i], new Set());
        if (!adjacency.has(ids[j])) adjacency.set(ids[j], new Set());
        adjacency.get(ids[i])!.add(ids[j]);
        adjacency.get(ids[j])!.add(ids[i]);
      }
    }
  }

  // 6. Serialize adjacency graph for client (Map<number, Set> → Record<number, number[]>)
  const adjacencyList: AdjacencyList = {};
  for (const [id, neighbors] of adjacency) {
    adjacencyList[id] = [...neighbors];
  }

  // Puzzle generation is done client-side (allows admin to regenerate with new seed)
  return (
    <HoopLinkGame
      players={rosterPlayers}
      playerTeams={playerTeams}
      adjacencyList={adjacencyList}
    />
  );
}
