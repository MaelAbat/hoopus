import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import PlayoffBracket from "@/components/PlayoffBracket";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";

export const revalidate = 3600;

export default async function Playoffs({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const season = seasonParam || getCurrentSeason();
  const supabase = await createClient();

  const [{ data: seasonRows }, { data: standings, error }, { data: series }, { data: playinGames }] = await Promise.all([
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
  ]);
  const availableSeasons = [...new Set((seasonRows || []).map((r: { season: string }) => r.season))];
  if (!availableSeasons.includes(season)) availableSeasons.unshift(season);

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
          image="https://images.unsplash.com/photo-1579487685737-e435a87b2518?w=1200&q=80"
          extra={
            <div className="flex flex-wrap items-center gap-3">
              <SeasonSelector current={season} available={availableSeasons} />
              {hasData ? (
                <span className="text-xs text-white/40">Basé sur le classement du {lastUpdate}</span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">
                  Synchronisation requise
                </span>
              )}
            </div>
          }
        />

        <SeasonContent>
          <ScrollReveal variant="up" delay={100}>
            <PlayoffBracket east={east} west={west} series={series || []} playinGames={playinGames || []} />
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
