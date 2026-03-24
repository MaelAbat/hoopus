import { createClient } from "@/lib/supabase/server";
import CalendarView from "@/components/CalendarView";
import PageBanner from "@/components/PageBanner";

export const revalidate = 3600;

export default async function Calendrier() {
  const supabase = await createClient();

  const [{ data: page1 }, { data: page2 }] = await Promise.all([
    supabase
      .from("games")
      .select("*")
      .eq("season", "2025-26")
      .order("game_date", { ascending: true })
      .range(0, 999),
    supabase
      .from("games")
      .select("*")
      .eq("season", "2025-26")
      .order("game_date", { ascending: true })
      .range(1000, 1999),
  ]);

  const games = [...(page1 || []), ...(page2 || [])];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Calendrier"
        subtitle="Saison régulière 2025-26"
        image="https://images.unsplash.com/photo-1693164586646-f3f877aec626?w=1200&q=80"
      />
      <CalendarView games={games || []} />
    </div>
  );
}
