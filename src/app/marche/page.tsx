import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { OG_IMAGE } from "@/lib/seo";
import {
  buildSeasonOptions,
  seasonRange,
  seasonStartYear,
  seasonStatus,
  seasonStatusLabel,
} from "@/lib/season";
import { getLeagueState } from "@/lib/league-season";
import { estimateSeasonPhases, type PhaseKey, type SeasonPhase } from "@/lib/season-phases";
import type { MarketEvent } from "@/lib/market";
import MarketDraftPanel from "@/components/MarketDraftPanel";
import MarketView from "@/components/MarketView";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";

export const revalidate = 3600;

export const metadata = {
  title: "Marché NBA — échanges, signatures et draft",
  description:
    "Tout ce qui bouge en NBA hors des parquets : échanges, signatures, joueurs coupés, draft et loterie. Le marché saison par saison, en français, sur Hoopus.",
  alternates: { canonical: "/marche" },
  openGraph: {
    title: "Marché NBA · Hoopus",
    description: "Échanges, signatures, coupes, draft : le marché NBA saison par saison.",
    images: [OG_IMAGE],
  },
};

interface EventRow {
  id: number;
  event_key: string;
  season: string;
  event_date: string;
  phase: string | null;
  kind: string;
  teams: string[] | null;
  from_team: string | null;
  to_team: string | null;
  players: MarketEvent["players"] | null;
  assets: MarketEvent["assets"] | null;
  contract: MarketEvent["contract"] | null;
  detail: string | null;
  raw: string;
}

export default async function MarchePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; type?: string; equipe?: string; periode?: string }>;
}) {
  const params = await searchParams;
  const leagueState = await getLeagueState();
  const { currentSeason } = leagueState;
  const season = params.season || currentSeason;
  const supabase = await createClient();

  const draftYear = seasonStartYear(season);

  const [
    rows,
    { data: earliest },
    { data: phaseRows },
    { data: draftPicks },
    { data: lotteryRows },
    { count: pickCount },
  ] = await Promise.all([
      // Lecture paginée : une saison dépasse le millier de mouvements, et
      // PostgREST tronque à mille sans le dire. Les compteurs de la page se
      // calculeraient alors sur un morceau de saison.
      fetchAllRows<EventRow>(
        (from, to) =>
          supabase
            .from("league_events")
            .select(
              "id, event_key, season, event_date, phase, kind, teams, from_team, to_team, players, assets, contract, detail, raw"
            )
            .eq("season", season)
            .order("event_date", { ascending: false })
            .order("id", { ascending: true })
            .range(from, to),
        { label: `mouvements ${season}`, maxRows: 6000 }
      ),
      // Une seule ligne suffit à connaître le début de l'historique : la liste des
      // saisons s'en déduit, sans rapatrier des milliers de lignes pour les
      // dédoublonner.
      supabase.from("league_events").select("season").order("season").limit(1),
      supabase
        .from("season_phases")
        .select("season, phase, starts_on, ends_on, is_estimated")
        .eq("season", season),
      // Draft et loterie : le haut de chaque tableau suffit ici, la page de draft
      // porte le détail.
      supabase
        .from("draft_picks")
        .select("pick_overall, team_tricode, player_name, player_id")
        .eq("season", season)
        .lte("pick_overall", 5)
        .order("pick_overall"),
      supabase
        .from("draft_lottery")
        .select("team_tricode, pre_lottery_rank, wins, losses, odds_top1, tied")
        .eq("draft_year", draftYear)
        .lte("pre_lottery_rank", 5)
        .order("pre_lottery_rank"),
      supabase
        .from("draft_picks")
        .select("*", { count: "exact", head: true })
        .eq("season", season),
    ]);

  const events: MarketEvent[] = rows.map((row) => ({
    id: row.id,
    event_key: row.event_key,
    season: row.season,
    event_date: row.event_date,
    phase: (row.phase as PhaseKey | null) ?? null,
    kind: row.kind as MarketEvent["kind"],
    teams: row.teams ?? [],
    from_team: row.from_team,
    to_team: row.to_team,
    players: row.players ?? [],
    assets: row.assets ?? [],
    contract: row.contract ?? null,
    detail: row.detail,
    raw: row.raw,
  }));

  // Les périodes en base peuvent être incomplètes tant qu'aucune
  // synchronisation n'est passée : on complète par les estimations, comme le
  // fait le sync, pour que la frise ne soit jamais vide.
  const stored: SeasonPhase[] = (phaseRows || []).map((row) => ({
    season: row.season,
    phase: row.phase as PhaseKey,
    startsOn: row.starts_on,
    endsOn: row.ends_on ?? row.starts_on,
    isEstimated: row.is_estimated,
  }));
  const known = new Set(stored.map((p) => p.phase));
  const phases = [...stored, ...estimateSeasonPhases(season).filter((p) => !known.has(p.phase))];

  const firstSeason = earliest?.[0]?.season;
  const availableSeasons = buildSeasonOptions(
    firstSeason ? seasonRange(firstSeason, currentSeason) : [],
    currentSeason,
    season
  );
  const statuses = Object.fromEntries(
    availableSeasons.map((s) => [s, seasonStatusLabel(seasonStatus(s, leagueState))])
  );

  const hasDraft = (pickCount ?? 0) > 0;

  return (
    <SeasonTransitionProvider>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageBanner
          title="Marché"
          subtitle="Échanges, signatures, coupes et draft — tout ce qui bouge hors des parquets"
          variant="teams"
          extra={
            <div className="flex flex-wrap items-center gap-3">
              <SeasonSelector
                current={season}
                available={availableSeasons}
                defaultSeason={currentSeason}
                statuses={statuses}
              />
              {hasDraft && (
                <Link
                  href={`/draft/${season}`}
                  className="inline-flex items-center border border-accent bg-accent-light px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent transition-colors hover:bg-accent hover:text-white"
                >
                  Draft {season.slice(0, 4)}
                </Link>
              )}
              {events.length === 0 && (
                <span className="inline-flex items-center border border-rule px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  Synchronisation requise
                </span>
              )}
            </div>
          }
        />

        <SeasonContent>
          <ScrollReveal variant="up" delay={100}>
            <MarketView
              season={season}
              events={events}
              phases={phases}
              initialKind={params.type}
              initialTeam={params.equipe}
              initialPhase={params.periode}
              draftPanel={
                <MarketDraftPanel
                  season={season}
                  picks={draftPicks || []}
                  lottery={lotteryRows || []}
                  totalPicks={pickCount ?? 0}
                />
              }
            />
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
