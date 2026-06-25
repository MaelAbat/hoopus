import { createClient } from "@/lib/supabase/server";
import { OG_IMAGE } from "@/lib/seo";
import { getCurrentSeason } from "@/lib/season";
import TeamsView from "@/components/TeamsView";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";

export const revalidate = 3600;

export const metadata = {
  title: "Équipes NBA",
  description:
    "Les 30 franchises NBA : effectifs complets, masses salariales et détails par équipe, saison après saison. Explorez chaque roster sur Hoopus.",
  alternates: { canonical: "/equipes" },
  openGraph: {
    title: "Équipes NBA · Hoopus",
    description: "Effectifs et masses salariales des 30 franchises de la ligue.",
    images: [OG_IMAGE],
  },
};

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
          variant="teams"
          extra={
            <div className="flex flex-wrap items-center gap-3">
              <SeasonSelector current={season} available={availableSeasons} />
              {hasData ? (
                <span className="font-mono text-[11px] uppercase tracking-wider text-text-faint">Mis à jour le {lastUpdate}</span>
              ) : (
                <span className="inline-flex items-center border border-accent px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent-text">
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
