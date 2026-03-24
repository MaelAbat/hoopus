import { createClient } from "@/lib/supabase/server";
import StandingsView from "@/components/StandingsView";
import PageBanner from "@/components/PageBanner";

export const revalidate = 3600;

export default async function Classement() {
  const supabase = await createClient();

  const { data: standings, error } = await supabase
    .from("standings")
    .select("*")
    .eq("season", "2025-26")
    .order("conference_rank", { ascending: true });

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
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Classement"
        subtitle="Saison régulière 2025-26"
        image="https://images.unsplash.com/photo-1578269174936-2709b6aeb913?w=1200&q=80"
        extra={hasData ? (
          <span className="text-xs text-white/40">Mis à jour le {lastUpdate}</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">
            Synchronisation requise
          </span>
        )}
      />

      <StandingsView east={east} west={west} />
    </div>
  );
}
