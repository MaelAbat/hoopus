import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import CalendarView from "@/components/CalendarView";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";

export const revalidate = 3600;

export default async function Calendrier({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const season = seasonParam || getCurrentSeason();
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
  const availableSeasons = seasonChecks.filter((s): s is string => s !== null);
  if (!availableSeasons.includes(season)) availableSeasons.unshift(season);

  const games = [...(page1 || []), ...(page2 || []), ...(page3 || [])];

  return (
    <SeasonTransitionProvider>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageBanner
          title="Calendrier"
          subtitle={`${seasonLabel(season)} -- saison régulière`}
          image="https://images.unsplash.com/photo-1693164586646-f3f877aec626?w=1200&q=80"
          extra={<SeasonSelector current={season} available={availableSeasons} />}
        />
        <SeasonContent>
          <ScrollReveal variant="up" delay={100}>
            <CalendarView games={games || []} />
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
