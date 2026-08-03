import { createClient } from "@/lib/supabase/server";
import { OG_IMAGE } from "@/lib/seo";
import { buildSeasonOptions, seasonStatus, seasonStatusLabel } from "@/lib/season";
import { getCapLevels } from "@/lib/cap-levels";
import { getLeagueState } from "@/lib/league-season";
import TeamsView from "@/components/TeamsView";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";

export const revalidate = 3600;

export const metadata = {
  title: "Équipes NBA",
  description:
    "Les 30 franchises NBA : effectifs complets, masses salariales et détails par équipe, saison après saison. Explorez chaque roster sur Hoopus.",
  alternates: { canonical: "/equipes" },
  openGraph: {
    title: "Équipes NBA · Hoopus",
    description: "Effectifs et masses salariales des 30 franchises de la ligue.",
    images: [OG_IMAGE],
  },
};

export default async function Equipes({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: seasonParam } = await searchParams;
  const leagueState = await getLeagueState();
  const { currentSeason, statsSeason } = leagueState;
  // Les effectifs suivent la ligue : ils basculent dès la fin des Finales.
  const season = seasonParam || currentSeason;
  const capLevels = await getCapLevels(season);
  const supabase = await createClient();

  const [{ data: seasonRows }, { data: players, error }, { data: payrolls }] = await Promise.all([
    supabase.from("standings").select("season").order("season", { ascending: false }).limit(1000),
    supabase
      .from("rosters")
      .select("*")
      .eq("season", season)
      .order("team_tricode", { ascending: true })
      .order("last_name", { ascending: true }),
    supabase
      .from("team_payrolls")
      .select("*")
      .eq("season", season),
  ]);
  const availableSeasons = buildSeasonOptions(
    (seasonRows || []).map((r: { season: string }) => r.season),
    currentSeason,
    season
  );
  const statuses = Object.fromEntries(
    availableSeasons.map((s) => [s, seasonStatusLabel(seasonStatus(s, leagueState))])
  );

  const hasData = !error && players && players.length > 0;

  // ── Statistiques de référence ──
  // Les effectifs d'une saison qui n'a pas commencé n'ont aucune moyenne par
  // match. Plutôt que des colonnes vides pendant toute l'intersaison, on reprend
  // les moyennes de la dernière saison jouée, en l'indiquant clairement.
  let statsFromSeason: string | null = null;
  if (hasData && statsSeason !== season && !players.some((p) => p.pts != null && p.pts > 0)) {
    const { data: refRows } = await supabase
      .from("rosters")
      .select("player_id, pts, reb, ast")
      .eq("season", statsSeason);

    const ref = new Map((refRows || []).map((r) => [r.player_id, r]));
    let matched = 0;
    for (const p of players) {
      const r = ref.get(p.player_id);
      if (!r) continue;
      p.pts = r.pts;
      p.reb = r.reb;
      p.ast = r.ast;
      matched++;
    }
    if (matched > 0) statsFromSeason = statsSeason;
  }

  const lastUpdate = hasData
    ? new Date(players[0].updated_at).toLocaleString("fr-FR", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <SeasonTransitionProvider>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageBanner
          title="Équipes"
          subtitle={`Effectifs ${season}`}
          variant="teams"
          extra={
            <div className="flex flex-wrap items-center gap-3">
              <SeasonSelector
                current={season}
                available={availableSeasons}
                defaultSeason={currentSeason}
                statuses={statuses}
              />
              {capLevels.isEstimated && (
                <span
                  className="inline-flex items-center border border-amber-500 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-500"
                  title="La ligue n'a pas encore publié ses seuils pour cette saison : les montants sont projetés."
                >
                  Seuils estimés
                </span>
              )}
              {hasData ? (
                <span className="font-mono text-[11px] uppercase tracking-wider text-text-faint">Mis à jour le {lastUpdate}</span>
              ) : (
                <span className="inline-flex items-center border border-accent px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent-text">
                  Synchronisation requise
                </span>
              )}
            </div>
          }
        />

        <SeasonContent>
          <ScrollReveal variant="up" delay={100}>
            <TeamsView players={players || []} payrolls={payrolls || []} statsFromSeason={statsFromSeason} thresholds={capLevels} />
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
