import { createClient } from "@/lib/supabase/server";
import PlayoffBracket from "@/components/PlayoffBracket";

export const revalidate = 3600;

export default async function Playoffs() {
  const supabase = await createClient();

  const [{ data: standings, error }, { data: series }, { data: playinGames }] = await Promise.all([
    supabase
      .from("standings")
      .select("*")
      .eq("season", "2025-26")
      .order("conference_rank", { ascending: true }),
    supabase
      .from("playoff_series")
      .select("*")
      .eq("season", "2025-26")
      .order("round", { ascending: true }),
    supabase
      .from("playin_games")
      .select("*")
      .eq("season", "2025-26"),
  ]);

  const hasData = !error && standings && standings.length > 0;

  const east = hasData ? standings.filter((s) => s.conference === "East") : [];
  const west = hasData ? standings.filter((s) => s.conference === "West") : [];

  const lastUpdate = hasData
    ? new Date(standings[0].updated_at).toLocaleString("fr-FR", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Playoffs</h1>
        <p className="mt-1 text-text-muted">
          Bracket 2025-26
          {hasData ? (
            <span className="ml-2 text-xs text-text-faint">
              Basé sur le classement du {lastUpdate}
            </span>
          ) : (
            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
              Synchronisation requise
            </span>
          )}
        </p>
      </div>

      <PlayoffBracket east={east} west={west} series={series || []} playinGames={playinGames || []} />
    </div>
  );
}
