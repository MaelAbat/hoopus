import { createClient } from "@/lib/supabase/server";
import CalendarView from "@/components/CalendarView";

export default async function Calendrier() {
  const supabase = await createClient();

  const { data: games } = await supabase
    .from("games")
    .select("*")
    .eq("season", "2025-26")
    .order("game_date", { ascending: true });

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
