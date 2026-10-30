import { createPublicClient } from "@/lib/supabase/public";
import { OG_IMAGE } from "@/lib/seo";
import { buildSeasonOptions, seasonLabel, seasonStatus, seasonStatusLabel } from "@/lib/season";
import { getLeagueState } from "@/lib/league-season";
import StandingsView from "@/components/StandingsView";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonEmptyState from "@/components/SeasonEmptyState";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";

export const revalidate = 3600;

export const metadata = {
  title: "Classement NBA",
  description:
    "Le classement NBA complet, conférences Est et Ouest : bilans victoires-défaites, séries en cours et écart sur la tête de division, mis à jour chaque jour.",
  alternates: { canonical: "/classement" },
  openGraph: {
    title: "Classement NBA · Hoopus",
    description: "Conférences Est et Ouest, bilans et séries en cours, mis à jour chaque jour.",
    images: [OG_IMAGE],
  },
};

export default async function Classement({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const leagueState = await getLeagueState();
  // Le classement s'ouvre sur la dernière saison jouée : celle à venir est vide.
  const defaultSeason = leagueState.statsSeason;
  const season = seasonParam || defaultSeason;
  const supabase = createPublicClient({ revalidate: 3600 });

  const [{ data: seasonRows }, { data: standings, error }] = await Promise.all([
    supabase.from("standings").select("season").order("season", { ascending: false }).limit(1000),
    supabase.from("standings").select("*").eq("season", season).order("conference_rank", { ascending: true }),
  ]);

  // La saison de la ligue figure dans la liste même sans données, pour qu'elle
  // soit atteignable dès sa bascule.
  const availableSeasons = buildSeasonOptions(
    (seasonRows || []).map((r: { season: string }) => r.season),
    leagueState.currentSeason,
    season
  );
  const statuses = Object.fromEntries(
    availableSeasons.map((s) => [s, seasonStatusLabel(seasonStatus(s, leagueState))])
  );
  const status = seasonStatus(season, leagueState);

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
          subtitle={`${seasonLabel(season)} — saison régulière`}
          variant="standings"
          extra={
            <div className="flex flex-wrap items-center gap-3">
              <SeasonSelector
                current={season}
                available={availableSeasons}
                defaultSeason={defaultSeason}
                statuses={statuses}
              />
              {hasData && (
                <span className="font-mono text-[11px] uppercase tracking-wider text-text-faint">Mis à jour le {lastUpdate}</span>
              )}
            </div>
          }
        />


        <SeasonContent>
          <ScrollReveal variant="up" delay={100}>
            {hasData ? (
              <StandingsView east={east} west={west} />
            ) : (
              <SeasonEmptyState
                season={season}
                status={status}
                what="Le classement et les bilans"
                fallbackSeason={season !== defaultSeason ? defaultSeason : null}
              />
            )}
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
