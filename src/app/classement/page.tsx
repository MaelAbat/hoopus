import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import StandingsView from "@/components/StandingsView";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";

export const revalidate = 3600;

export default async function Classement({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const season = seasonParam || getCurrentSeason();
  const supabase = await createClient();

  const [{ data: seasonRows }, { data: standings, error }] = await Promise.all([
    supabase.from("standings").select("season").order("season", { ascending: false }).limit(1000),
    supabase.from("standings").select("*").eq("season", season).order("conference_rank", { ascending: true }),
  ]);
  const availableSeasons = [...new Set((seasonRows || []).map((r: { season: string }) => r.season))];
  if (!availableSeasons.includes(season)) availableSeasons.unshift(season);

  const hasData = !error && standings && standings.length > 0;

  const lastUpdate = hasData
    ? new Date(standings[0].updated_at).toLocaleString("fr-FR", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const east = hasData
    ? standings.filter((s) => s.conference === "East")
    : [];
  const west = hasData
    ? standings.filter((s) => s.conference === "West")
    : [];

  return (
    <SeasonTransitionProvider>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageBanner
          title="Classement"
          subtitle={`${seasonLabel(season)} -- saison régulière`}
          variant="standings"
          extra={
            <div className="flex flex-wrap items-center gap-3">
              <SeasonSelector current={season} available={availableSeasons} />
              {hasData ? (
                <span className="text-xs text-text-faint">Mis à jour le {lastUpdate}</span>
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
            <StandingsView east={east} west={west} />
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
