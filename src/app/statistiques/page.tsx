import { createClient } from "@/lib/supabase/server";
import type { PlayerStatLeader, StatCategory } from "@/lib/nba-api";
import StatsCarousel from "@/components/StatsCarousel";

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
        value: String(row.value),
      }));
  }

  const boardsData = BOARDS.map((b) => {
    const all = getLeaders(b.stat);
    // -1 = no eligibility concept, >= 0 = number of eligible players
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

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Statistiques</h1>
        <p className="mt-1 text-text-muted">
          Leaders de la saison 2025-26
          {hasData ? (
            <span className="ml-2 text-xs text-text-faint">
              Mis à jour le {lastUpdate}
            </span>
          ) : (
            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
              Synchronisation requise
            </span>
          )}
        </p>
      </div>

      <StatsCarousel boards={boardsData} />
    </div>
  );
}
