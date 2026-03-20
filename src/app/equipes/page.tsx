import { createClient } from "@/lib/supabase/server";
import TeamsView from "@/components/TeamsView";

export const revalidate = 3600;

export default async function Equipes() {
  const supabase = await createClient();

  const { data: players, error } = await supabase
    .from("rosters")
    .select("*")
    .eq("season", "2025-26")
    .order("team_tricode", { ascending: true })
    .order("last_name", { ascending: true });

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
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Équipes</h1>
        <p className="mt-1 text-text-muted">
          Effectifs 2025-26
          {hasData ? (
            <span className="ml-2 text-xs text-text-faint">
              Mis à jour le {lastUpdate}
            </span>
          ) : (
            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
              Synchronisation requise
            </span>
          )}
        </p>
      </div>

      <TeamsView players={players || []} />
    </div>
  );
}
