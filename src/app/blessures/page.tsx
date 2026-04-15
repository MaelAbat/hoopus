import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import InjuriesView from "@/components/InjuriesView";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";

export const revalidate = 3600;

export default async function Blessures() {
  const season = getCurrentSeason();
  const supabase = await createClient();

  const { data: injuries, error } = await supabase
    .from("injuries")
    .select("*")
    .eq("season", season)
    .order("team")
    .order("status")
    .order("player_name");

  const hasData = !error && injuries && injuries.length > 0;

  const lastUpdate = hasData
    ? new Date(injuries[0].updated_at).toLocaleString("fr-FR", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Infirmerie"
        subtitle={`Injury report -- ${seasonLabel(season)}`}
        variant="injuries"
        extra={
          hasData ? (
            <span className="text-xs text-text-faint">Mis a jour le {lastUpdate}</span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">
              Synchronisation requise
            </span>
          )
        }
      />

      <ScrollReveal variant="up" delay={100}>
        <InjuriesView injuries={injuries || []} />
      </ScrollReveal>
    </div>
  );
}
