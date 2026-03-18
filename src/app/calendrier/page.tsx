import { createClient } from "@/lib/supabase/server";
import CalendarView from "@/components/CalendarView";

export default async function Calendrier() {
  const supabase = await createClient();

  // Supabase limits to 1000 rows per request, so we paginate
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Calendrier</h1>
        <p className="mt-1 text-text-muted">Saison régulière 2025-26</p>
      </div>
      <CalendarView games={games || []} />
    </div>
  );
}
