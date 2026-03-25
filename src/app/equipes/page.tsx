import { createClient } from "@/lib/supabase/server";
import TeamsView from "@/components/TeamsView";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";

export const revalidate = 3600;

export default async function Equipes() {
  const supabase = await createClient();

  const [{ data: players, error }, { data: payrolls }] = await Promise.all([
    supabase
      .from("rosters")
      .select("*")
      .eq("season", "2025-26")
      .order("team_tricode", { ascending: true })
      .order("last_name", { ascending: true }),
    supabase
      .from("team_payrolls")
      .select("*")
      .eq("season", "2025-26"),
  ]);

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
      <PageBanner
        title="Équipes"
        subtitle="Effectifs 2025-26"
        image="https://images.unsplash.com/photo-1759694705159-fad2c93938f1?w=1200&q=80"
        extra={hasData ? (
          <span className="text-xs text-white/40">Mis à jour le {lastUpdate}</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">
            Synchronisation requise
          </span>
        )}
      />

      <ScrollReveal variant="up" delay={100}>
        <TeamsView players={players || []} payrolls={payrolls || []} />
      </ScrollReveal>
    </div>
  );
}
