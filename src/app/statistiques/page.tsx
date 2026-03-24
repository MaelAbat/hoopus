import { createClient } from "@/lib/supabase/server";
import type { PlayerStatLeader, StatCategory } from "@/lib/nba-api";
import StatsView from "@/components/StatsView";
import type { PlayerRow } from "@/components/StatsTable";
import type { TeamRow } from "@/components/TeamStatsTable";
import PageBanner from "@/components/PageBanner";

export const revalidate = 3600;

interface BoardConfig {
  title: string;
  stat: StatCategory;
  unit: string;
}

const BOARDS: BoardConfig[] = [
  { title: "Points", stat: "PTS", unit: "PPG" },
  { title: "Rebonds", stat: "REB", unit: "RPG" },
  { title: "Passes", stat: "AST", unit: "APG" },
  { title: "Contres", stat: "BLK", unit: "BPG" },
  { title: "Interceptions", stat: "STL", unit: "SPG" },
  { title: "Efficacité", stat: "EFF", unit: "EFF" },
  { title: "Pertes", stat: "TOV", unit: "TPG" },
  { title: "% au tir", stat: "FG_PCT", unit: "%" },
  { title: "% à 2pts", stat: "FG2_PCT", unit: "%" },
  { title: "% à 3pts", stat: "FG3_PCT", unit: "%" },
  { title: "% LF", stat: "FT_PCT", unit: "%" },
  { title: "TS%", stat: "TS_PCT", unit: "%" },
];

// Direct categories use GP-based eligibility
const GP_CATEGORIES = new Set(["PTS", "REB", "AST", "BLK", "STL", "EFF", "TOV"]);

export default async function Statistiques() {
  const supabase = await createClient();

  // Fetch all stat leaders with pagination (Supabase 1000 row limit)
  const pages = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      supabase
        .from("stat_leaders")
        .select("*")
        .eq("season", "2025-26")
        .order("rank", { ascending: true })
        .range(i * 1000, (i + 1) * 1000 - 1)
    )
  );

  const allLeaders = pages.flatMap((p) => p.data || []);
  const hasData = allLeaders.length > 0;

  const lastUpdate = hasData
    ? new Date(allLeaders[0].updated_at).toLocaleString("fr-FR", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Extract metadata rows (rank=0) for eligibility info
  const eligibleCounts: Partial<Record<StatCategory, number>> = {};
  for (const row of allLeaders) {
    if (row.rank === 0 && row.player_name === "__eligible_count__") {
      eligibleCounts[row.category as StatCategory] = row.value;
    }
  }

  function getLeaders(category: StatCategory): PlayerStatLeader[] {
    return allLeaders
      .filter((row) => row.category === category && row.rank > 0)
      .map((row) => ({
        rank: row.rank,
        name: row.player_name,
        team: row.team,
        value: Number(row.value).toFixed(2),
      }));
  }

  // Carousel data
  const boardsData = BOARDS.map((b) => {
    const all = getLeaders(b.stat);
    const eligibleCount = eligibleCounts[b.stat] ?? -1;
    return {
      title: b.title,
      stat: b.stat,
      unit: b.unit,
      top10: all.slice(0, 10),
      full: all,
      eligibleCount,
    };
  });

  // Table data: pivot by player — one row per player with all stats
  const playerMap = new Map<string, PlayerRow>();
  const gpEligibleCount = eligibleCounts["PTS"] ?? 0; // GP eligibility is same for all direct categories

  for (const row of allLeaders) {
    if (row.rank === 0) continue;
    const key = `${row.player_name}|${row.team}`;
    if (!playerMap.has(key)) {
      playerMap.set(key, {
        name: row.player_name,
        team: row.team,
        isEligible: false,
        stats: {},
      });
    }
    const player = playerMap.get(key)!;
    player.stats[row.category] = row.value;

    // A player is eligible if they're eligible in the GP-based categories
    if (GP_CATEGORIES.has(row.category) && row.rank <= gpEligibleCount) {
      player.isEligible = true;
    }
  }

  const tableData = Array.from(playerMap.values());

  // Team stats
  const { data: teamStatsRaw } = await supabase
    .from("team_stats")
    .select("*")
    .eq("season", "2025-26")
    .order("net_rating", { ascending: false });

  const teamData: TeamRow[] = (teamStatsRaw || []).map((t) => ({ ...t } as TeamRow));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageBanner
        title="Statistiques"
        subtitle="Leaders de la saison 2025-26"
        image="https://images.unsplash.com/photo-1705594975210-02cbcc7af5ad?w=1200&fit=crop"
        extra={hasData ? (
          <span className="text-xs text-white/40">Mis à jour le {lastUpdate}</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">
            Synchronisation requise
          </span>
        )}
      />

      <StatsView boards={boardsData} tableData={tableData} teamData={teamData} />
    </div>
  );
}
