import { createClient } from "@/lib/supabase/server";
import { OG_IMAGE } from "@/lib/seo";
import { buildSeasonOptions, seasonStatus, seasonStatusLabel } from "@/lib/season";
import { getLeagueState } from "@/lib/league-season";
import PlayoffBracket from "@/components/PlayoffBracket";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import OffseasonNotice from "@/components/OffseasonNotice";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";

export const revalidate = 3600;

export const metadata = {
  title: "Playoffs NBA",
  description:
    "Le tableau des playoffs NBA : bracket complet, séries en cours et résultats tour par tour, de la course au titre jusqu'aux Finales. À suivre sur Hoopus.",
  alternates: { canonical: "/playoffs" },
  openGraph: {
    title: "Playoffs NBA · Hoopus",
    description: "Bracket complet et séries en cours jusqu'aux Finales NBA.",
    images: [OG_IMAGE],
  },
};

export default async function Playoffs({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const leagueState = await getLeagueState();
  // Le bracket concerne une saison jouée : défaut sur la dernière.
  const defaultSeason = leagueState.statsSeason;
  const season = seasonParam || defaultSeason;
  const supabase = await createClient();

  const PLAYOFF_STAT_CATEGORIES = ["PTS", "REB", "AST", "STL", "BLK", "FG_PCT", "FG3_PCT", "TS_PCT"];

  const [
    { data: seasonRows },
    { data: standings, error },
    { data: series },
    { data: playinGames },
    { data: playoffLeaders },
    { data: playoffTeamStats },
  ] = await Promise.all([
    supabase.from("standings").select("season").order("season", { ascending: false }).limit(1000),
    supabase
      .from("standings")
      .select("*")
      .eq("season", season)
      .order("conference_rank", { ascending: true }),
    supabase
      .from("playoff_series")
      .select("*")
      .eq("season", season)
      .order("round", { ascending: true }),
    supabase
      .from("playin_games")
      .select("*")
      .eq("season", season),
    supabase
      .from("stat_leaders")
      .select("category, rank, player_name, player_id, team, value")
      .eq("season", season)
      .eq("season_type", "playoffs")
      .in("category", PLAYOFF_STAT_CATEGORIES)
      .gt("rank", 0)
      .lte("rank", 10)
      .order("rank", { ascending: true }),
    supabase
      .from("team_stats")
      .select("team_id, team_name, team_tricode, gp, w, l, pts, reb, ast, off_rating, def_rating, net_rating, ts_pct")
      .eq("season", season)
      .eq("season_type", "playoffs")
      .order("net_rating", { ascending: false }),
  ]);
  const availableSeasons = buildSeasonOptions(
    (seasonRows || []).map((r: { season: string }) => r.season),
    leagueState.currentSeason,
    season
  );
  const statuses = Object.fromEntries(
    availableSeasons.map((s) => [s, seasonStatusLabel(seasonStatus(s, leagueState))])
  );
  const status = seasonStatus(season, leagueState);

  // Enrich each series game with its game_id by looking up (date, home, away)
  // in the games table — avoids needing the playoff sync to store it.
  type SeriesRow = NonNullable<typeof series>[number];
  type SeriesGameRow = SeriesRow["games"][number];
  const allSeriesGames: SeriesGameRow[] = (series || []).flatMap((s) => s.games || []);
  const seriesDates = [...new Set(allSeriesGames.map((g) => g.game_date).filter(Boolean))];
  let gameIdByKey = new Map<string, string>();
  if (seriesDates.length > 0) {
    const { data: games } = await supabase
      .from("games")
      .select("game_id, game_date, home_team, away_team")
      .in("game_date", seriesDates);
    gameIdByKey = new Map(
      (games || []).map((g) => [`${g.game_date}|${g.home_team}|${g.away_team}`, g.game_id])
    );
  }
  const enrichedSeries = (series || []).map((s) => ({
    ...s,
    games: (s.games || []).map((g: SeriesGameRow) => ({
      ...g,
      game_id: gameIdByKey.get(`${g.game_date}|${g.home_team}|${g.away_team}`),
    })),
  }));

  const hasData = !error && standings && standings.length > 0;

  const east = hasData ? standings.filter((s) => s.conference === "East") : [];
  const west = hasData ? standings.filter((s) => s.conference === "West") : [];

  const lastUpdate = hasData
    ? new Date(standings[0].updated_at).toLocaleString("fr-FR", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <SeasonTransitionProvider>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageBanner
          title="Playoffs"
          subtitle={`Bracket ${season}`}
          variant="playoffs"
          extra={
            <div className="flex flex-wrap items-center gap-3">
              <SeasonSelector
                current={season}
                available={availableSeasons}
                defaultSeason={defaultSeason}
                statuses={statuses}
              />
              <span
                className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                  status === "current"
                    ? "border-accent text-accent-text"
                    : "border-rule text-text-muted"
                }`}
              >
                {seasonStatusLabel(status)}
              </span>
              {hasData && (
                <span className="tnum text-xs text-text-faint">Basé sur le classement du {lastUpdate}</span>
              )}
            </div>
          }
        />

        {status === "completed" && <OffseasonNotice variant="compact" />}

        <SeasonContent>
          <ScrollReveal variant="up" delay={100}>
            <PlayoffBracket
              east={east}
              west={west}
              series={enrichedSeries}
              playinGames={playinGames || []}
              playoffLeaders={playoffLeaders || []}
              playoffTeamStats={playoffTeamStats || []}
            />
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
