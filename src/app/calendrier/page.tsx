import { createClient } from "@/lib/supabase/server";
import { OG_IMAGE } from "@/lib/seo";
import { buildSeasonOptions, seasonLabel, seasonStatus, seasonStatusLabel } from "@/lib/season";
import { getLeagueState } from "@/lib/league-season";
import CalendarView from "@/components/CalendarView";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonEmptyState from "@/components/SeasonEmptyState";
import OffseasonNotice from "@/components/OffseasonNotice";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";

export const revalidate = 3600;

export const metadata = {
  title: "Calendrier NBA",
  description:
    "Le calendrier NBA complet : tous les matchs, horaires et résultats, jour après jour. Ne manquez aucune rencontre de la saison sur Hoopus.",
  alternates: { canonical: "/calendrier" },
  openGraph: {
    title: "Calendrier NBA · Hoopus",
    description: "Tous les matchs, horaires et résultats de la saison NBA.",
    images: [OG_IMAGE],
  },
};

export default async function Calendrier({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const leagueState = await getLeagueState();
  // Le calendrier suit le programme publié, pas la dernière saison jouée : le
  // nouveau calendrier doit apparaître dès sa parution.
  const defaultSeason = leagueState.scheduleSeason;
  const season = seasonParam || defaultSeason;
  const supabase = await createClient();

  // Fetch one game per potential season to discover available seasons
  const potentialSeasons: string[] = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 2015; y--) {
    potentialSeasons.push(`${y}-${String(y + 1).slice(-2)}`);
  }

  const [seasonChecks, { data: page1 }, { data: page2 }, { data: page3 }] = await Promise.all([
    Promise.all(
      potentialSeasons.map(async (s) => {
        const { count } = await supabase
          .from("games")
          .select("game_id", { count: "exact", head: true })
          .eq("season", s);
        return count && count > 0 ? s : null;
      })
    ),
    supabase
      .from("games")
      .select("*")
      .eq("season", season)
      .order("game_date", { ascending: true })
      .range(0, 999),
    supabase
      .from("games")
      .select("*")
      .eq("season", season)
      .order("game_date", { ascending: true })
      .range(1000, 1999),
    supabase
      .from("games")
      .select("*")
      .eq("season", season)
      .order("game_date", { ascending: true })
      .range(2000, 2999),
  ]);
  const availableSeasons = buildSeasonOptions(
    seasonChecks.filter((s): s is string => s !== null),
    leagueState.currentSeason,
    season
  );
  const statuses = Object.fromEntries(
    availableSeasons.map((s) => [s, seasonStatusLabel(seasonStatus(s, leagueState))])
  );
  const status = seasonStatus(season, leagueState);

  const games = [...(page1 || []), ...(page2 || []), ...(page3 || [])];

  return (
    <SeasonTransitionProvider>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageBanner
          title="Calendrier"
          subtitle={`${seasonLabel(season)} — saison régulière`}
          variant="calendar"
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
            </div>
          }
        />

        {status === "completed" && <OffseasonNotice variant="compact" />}

        <SeasonContent>
          <ScrollReveal variant="up" delay={100}>
            {games.length > 0 ? (
              <CalendarView games={games} initialSeason={season} />
            ) : (
              <SeasonEmptyState
                season={season}
                status={status}
                what="Le calendrier et les résultats"
                fallbackSeason={season !== defaultSeason ? defaultSeason : null}
              />
            )}
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
