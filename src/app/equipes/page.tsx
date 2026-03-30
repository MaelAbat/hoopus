import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import TeamsView from "@/components/TeamsView";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";

export const revalidate = 3600;

export default async function Equipes({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const season = seasonParam || getCurrentSeason();
  const supabase = await createClient();

  const [{ data: seasonRows }, { data: players, error }, { data: payrolls }] = await Promise.all([
    supabase.from("standings").select("season").order("season", { ascending: false }).limit(1000),
    supabase
      .from("rosters")
      .select("*")
      .eq("season", season)
      .order("team_tricode", { ascending: true })
      .order("last_name", { ascending: true }),
    supabase
      .from("team_payrolls")
      .select("*")
      .eq("season", season),
  ]);
  const availableSeasons = [...new Set((seasonRows || []).map((r: { season: string }) => r.season))];
  if (!availableSeasons.includes(season)) availableSeasons.unshift(season);

  const hasData = !error && players && players.length > 0;

  const lastUpdate = hasData
    ? new Date(players[0].updated_at).toLocaleString("fr-FR", {
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
          title="Équipes"
          subtitle={`Effectifs ${season}`}
          image="https://images.unsplash.com/photo-1759694705159-fad2c93938f1?w=1200&q=80"
          extra={
            <div className="flex flex-wrap items-center gap-3">
              <SeasonSelector current={season} available={availableSeasons} />
              {hasData ? (
                <span className="text-xs text-white/40">Mis à jour le {lastUpdate}</span>
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
            <TeamsView players={players || []} payrolls={payrolls || []} />
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
