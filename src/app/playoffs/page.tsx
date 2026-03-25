import { createClient } from "@/lib/supabase/server";
import PlayoffBracket from "@/components/PlayoffBracket";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";

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
      <PageBanner
        title="Playoffs"
        subtitle="Bracket 2025-26"
        image="https://images.unsplash.com/photo-1579487685737-e435a87b2518?w=1200&q=80"
        extra={hasData ? (
          <span className="text-xs text-white/40">Basé sur le classement du {lastUpdate}</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">
            Synchronisation requise
          </span>
        )}
      />

      <ScrollReveal variant="up" delay={100}>
        <PlayoffBracket east={east} west={west} series={series || []} playinGames={playinGames || []} />
      </ScrollReveal>
    </div>
  );
}
