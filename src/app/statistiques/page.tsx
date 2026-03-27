import { createClient } from "@/lib/supabase/server";
import type { PlayerStatLeader, StatCategory } from "@/lib/nba-api";
import StatsView from "@/components/StatsView";
import type { PlayerRow } from "@/components/StatsTable";
import type { TeamRow } from "@/components/TeamStatsTable";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";

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
  { title: "Minutes", stat: "MIN", unit: "MPG" },
  { title: "Efficacite", stat: "EFF", unit: "EFF" },
  { title: "Pertes", stat: "TOV", unit: "TPG" },
  { title: "% au tir", stat: "FG_PCT", unit: "%" },
  { title: "% a 2pts", stat: "FG2_PCT", unit: "%" },
  { title: "% a 3pts", stat: "FG3_PCT", unit: "%" },
  { title: "% LF", stat: "FT_PCT", unit: "%" },
  { title: "TS%", stat: "TS_PCT", unit: "%" },
  { title: "eFG%", stat: "EFG_PCT", unit: "%" },
  { title: "USG%", stat: "USG_PCT", unit: "%" },
  { title: "OFF RTG", stat: "OFF_RATING", unit: "RTG" },
  { title: "DEF RTG", stat: "DEF_RATING", unit: "RTG" },
  { title: "NET RTG", stat: "NET_RATING", unit: "RTG" },
  { title: "PACE", stat: "PACE", unit: "PACE" },
  { title: "PIE", stat: "PIE", unit: "PIE" },
];

// Direct categories use GP-based eligibility
const GP_CATEGORIES = new Set(["PTS", "REB", "AST", "BLK", "STL", "EFF", "TOV", "MIN", "OREB", "DREB"]);

export default async function Statistiques() {
  const supabase = await createClient();

  // Fetch all stat leaders with pagination (more pages for advanced stats)
  const pages = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      supabase
        .from("stat_leaders")
        .select("*")
        .eq("season", "2025-26")
        .order("rank", { ascending: true })
        .order("category", { ascending: true })
        .order("player_id", { ascending: true })
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
    const seen = new Set<number>();
    return allLeaders
      .filter((row) => row.category === category && row.rank > 0)
      .filter((row) => {
        if (row.player_id && seen.has(row.player_id)) return false;
        if (row.player_id) seen.add(row.player_id);
        return true;
      })
      .map((row) => ({
        rank: row.rank,
        name: row.player_name,
        team: row.team,
        value: Number(row.value).toFixed(2),
        player_id: row.player_id ?? 0,
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

  // Table data: pivot by player - one row per player with all stats
  const playerMap = new Map<string, PlayerRow>();
  const gpEligibleCount = eligibleCounts["PTS"] ?? 0;

  // All categories to include in the pivot (for both base and advanced table views)
  const ALL_CATEGORIES: StatCategory[] = [
    "PTS", "REB", "AST", "BLK", "STL", "EFF", "TOV", "MIN", "OREB", "DREB", "GP", "TOT_MIN",
    "FGA_TOT", "FG3A_TOT", "FTA_TOT", "FG2A_TOT",
    "FG_PCT", "FG2_PCT", "FG3_PCT", "FT_PCT", "TS_PCT", "EFG_PCT",
    "USG_PCT", "OFF_RATING", "DEF_RATING", "NET_RATING",
    "AST_PCT", "OREB_PCT", "DREB_PCT", "REB_PCT", "PACE", "PIE",
    "TS_PLUS", "EFG_PLUS", "FG_PLUS", "FG3_PLUS", "FT_PLUS", "FG2_PLUS",
    "PTS_TOT", "REB_TOT", "AST_TOT", "BLK_TOT", "STL_TOT", "TOV_TOT",
    "FGM_TOT", "FG3M_TOT", "FTM_TOT", "FG2M_TOT",
    "OREB_TOT", "DREB_TOT", "PF_TOT", "PLUS_MINUS_TOT",
  ];

  for (const row of allLeaders) {
    if (row.rank === 0) continue;
    if (!ALL_CATEGORIES.includes(row.category as StatCategory)) continue;

    const key = `${row.player_name}|${row.team}`;
    if (!playerMap.has(key)) {
      playerMap.set(key, {
        name: row.player_name,
        team: row.team,
        playerId: row.player_id ?? 0,
        isEligible: false,
        stats: {},
      });
    }
    const player = playerMap.get(key)!;
    player.stats[row.category] = row.value;

    // Use player_id from any row that has it
    if (row.player_id && !player.playerId) {
      player.playerId = row.player_id;
    }

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
          <span className="text-xs text-white/40">Mis a jour le {lastUpdate}</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">
            Synchronisation requise
          </span>
        )}
      />

      <ScrollReveal variant="up" delay={100}>
        <StatsView boards={boardsData} tableData={tableData} teamData={teamData} />
      </ScrollReveal>
    </div>
  );
}
