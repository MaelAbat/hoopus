import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import CalendarView from "@/components/CalendarView";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonSelector from "@/components/SeasonSelector";

export const revalidate = 3600;

export default async function Calendrier({ searchParams }: { searchParams: Promise<{ season?: string; date?: string }> }) {
  const { season: seasonParam, date: dateParam } = await searchParams;
  const season = seasonParam || getCurrentSeason();
  const supabase = await createClient();

  const [{ data: seasonRows }, { data: page1 }, { data: page2 }] = await Promise.all([
    supabase.from("standings").select("season").order("season", { ascending: false }).limit(1000),
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
  ]);
  const availableSeasons = [...new Set((seasonRows || []).map((r: { season: string }) => r.season))];
  if (!availableSeasons.includes(season)) availableSeasons.unshift(season);

  const games = [...(page1 || []), ...(page2 || [])];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Calendrier"
        subtitle={`${seasonLabel(season)} -- saison régulière`}
        image="https://images.unsplash.com/photo-1693164586646-f3f877aec626?w=1200&q=80"
        extra={<SeasonSelector current={season} available={availableSeasons} />}
      />
      <ScrollReveal variant="up" delay={100}>
        <CalendarView games={games || []} initialDate={dateParam} />
      </ScrollReveal>
    </div>
  );
}
