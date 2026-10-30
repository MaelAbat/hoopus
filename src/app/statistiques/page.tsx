import { createPublicClient } from "@/lib/supabase/public";
import { OG_IMAGE } from "@/lib/seo";
import { buildSeasonOptions, seasonLabel, seasonStatus, seasonStatusLabel } from "@/lib/season";
import { getLeagueState } from "@/lib/league-season";
import type { PlayerStatLeader, StatCategory } from "@/lib/nba-api";
import StatsView from "@/components/StatsView";
import type { PlayerRow } from "@/components/StatsTable";
import type { TeamRow } from "@/components/TeamStatsTable";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonEmptyState from "@/components/SeasonEmptyState";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";

export const revalidate = 3600;

export const metadata = {
  title: "Statistiques NBA",
  description:
    "Les leaders statistiques de la NBA : points, rebonds, passes, contres, interceptions et minutes par match. Classements des joueurs et des équipes, saison par saison.",
  alternates: { canonical: "/statistiques" },
  openGraph: {
    title: "Statistiques NBA · Hoopus",
    description: "Leaders points, rebonds, passes et plus, pour les joueurs et les équipes.",
    images: [OG_IMAGE],
  },
};

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
  { title: "Efficacité", stat: "EFF", unit: "EFF" },
  { title: "Pertes", stat: "TOV", unit: "TPG" },
  { title: "% au tir", stat: "FG_PCT", unit: "%" },
  { title: "% à 2pts", stat: "FG2_PCT", unit: "%" },
  { title: "% à 3pts", stat: "FG3_PCT", unit: "%" },
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

export default async function Statistiques({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const leagueState = await getLeagueState();
  // Les leaders portent sur des matchs joués : défaut sur la dernière saison jouée.
  const defaultSeason = leagueState.statsSeason;
  const season = seasonParam || defaultSeason;
  const supabase = createPublicClient({ revalidate: 3600 });

  // Le nombre de lignes d'abord, pour lire exactement le bon nombre de pages : un
  // nombre fixe de pages tronquait la saison sans le dire (30 406 lignes en
  // 2025-26 pour 30 000 lues). Le tri suit l'index de la migration 048, et
  // (rank, category, player_name) est unique dans une saison : aucune ligne ne
  // peut glisser d'une page à l'autre.
  const leadersOf = (countOnly = false) =>
    supabase
      .from("stat_leaders")
      .select(
        "category, rank, player_name, player_id, team, value, updated_at",
        countOnly ? { count: "exact", head: true } : undefined
      )
      .eq("season", season)
      .eq("season_type", "regular");

  const [{ data: seasonRows }, { count: leaderCount, error: countError }] = await Promise.all([
    supabase.from("standings").select("season").order("season", { ascending: false }).limit(1000),
    leadersOf(true),
  ]);
  if (countError) throw new Error(`stat_leaders ${season} : ${countError.message}`);

  // Quatre pages à la fois, pas toutes ensemble : vingt-deux requêtes simultanées
  // saturaient la base, et celles qui dépassaient le délai des visiteurs anonymes
  // échouaient en silence — juste après le cron, la page annonçait alors une
  // saison « pas encore synchronisée ». Une page qui échoue est retentée une
  // fois ; si elle échoue encore, le rendu échoue plutôt que d'afficher, et de
  // mettre en cache, une saison incomplète.
  const fetchPage = async (i: number) => {
    const query = () =>
      leadersOf()
        .order("rank", { ascending: true })
        .order("category", { ascending: true })
        .order("player_name", { ascending: true })
        .range(i * 1000, (i + 1) * 1000 - 1);
    const first = await query();
    if (!first.error) return first;
    const retry = await query();
    if (retry.error) throw new Error(`stat_leaders ${season}, page ${i} : ${retry.error.message}`);
    return retry;
  };
  const pageCount = Math.ceil((leaderCount ?? 0) / 1000);
  const pages: Awaited<ReturnType<typeof fetchPage>>[] = [];
  for (let start = 0; start < pageCount; start += 4) {
    const wave = Array.from({ length: Math.min(4, pageCount - start) }, (_, k) => fetchPage(start + k));
    pages.push(...(await Promise.all(wave)));
  }
  const availableSeasons = buildSeasonOptions(
    (seasonRows || []).map((r: { season: string }) => r.season),
    leagueState.currentSeason,
    season
  );
  const statuses = Object.fromEntries(
    availableSeasons.map((s) => [s, seasonStatusLabel(seasonStatus(s, leagueState))])
  );
  const status = seasonStatus(season, leagueState);

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
    .eq("season", season)
    .eq("season_type", "regular")
    .order("net_rating", { ascending: false });

  const teamData: TeamRow[] = (teamStatsRaw || []).map((t) => ({ ...t } as TeamRow));

  return (
    <SeasonTransitionProvider>
      <div className="mx-auto max-w-7xl space-y-8">
        <PageBanner
          title="Statistiques"
          subtitle={`Leaders de la ${seasonLabel(season).toLowerCase()}`}
          variant="stats"
          extra={
            <div className="flex flex-wrap items-center gap-3">
              <SeasonSelector
                current={season}
                available={availableSeasons}
                defaultSeason={defaultSeason}
                statuses={statuses}
              />
              {hasData && (
                <span className="font-mono text-[11px] uppercase tracking-wider text-text-faint">
                  <span className="tnum">Mis à jour le {lastUpdate}</span>
                </span>
              )}
            </div>
          }
        />


        <SeasonContent>
          <ScrollReveal variant="up" delay={100}>
            {hasData ? (
              <StatsView boards={boardsData} tableData={tableData} teamData={teamData} />
            ) : (
              <SeasonEmptyState
                season={season}
                status={status}
                what="Les statistiques et les leaders"
                fallbackSeason={season !== defaultSeason ? defaultSeason : null}
              />
            )}
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
