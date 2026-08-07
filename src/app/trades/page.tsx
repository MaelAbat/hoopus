import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OG_IMAGE } from "@/lib/seo";
import { TRADE_MACHINE_ENABLED } from "@/lib/feature-flags";
import { buildSeasonOptions, seasonStatus, seasonStatusLabel } from "@/lib/season";
import { getLeagueState } from "@/lib/league-season";
import { NBA_TEAM_COUNT, parseSalaryOrNull } from "@/lib/salary-cap";
import { getCapLevels } from "@/lib/cap-levels";
import { getSeasonPhases } from "@/lib/season-phases-db";
import { formatPhaseDate } from "@/lib/season-phases";
import { buildPickInventory } from "@/lib/draft-assets";
import { decodeTrade, type TradeRosterPlayer, type TradeWindow } from "@/lib/trade-rules";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";
import TradeMachine from "@/components/TradeMachine";

export const revalidate = 3600;

export const metadata = {
  title: "Trade Machine NBA",
  description:
    "Simulez des échanges NBA avec toutes les règles de la convention 2023 : concordance salariale, aprons, picks, cash, clauses de contrat. La trade machine Hoopus, en français.",
  alternates: { canonical: "/trades" },
  openGraph: {
    title: "Trade Machine NBA · Hoopus",
    description:
      "Construisez un échange jusqu'à cinq équipes — joueurs, picks, cash — et vérifiez s'il est légal.",
    images: [OG_IMAGE],
  },
};

interface RosterRow {
  player_id: number;
  first_name: string;
  last_name: string;
  team_tricode: string;
  team_city: string;
  team_name: string;
  position: string | null;
  age: number | null;
  salary: string | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
}

/**
 * Fenêtre d'échange de la saison.
 *
 * La ligue ferme les échanges à la date limite et ne les rouvre qu'après les
 * Finales. La contrainte ne s'applique qu'à la saison en cours : sur une saison
 * révolue, la trade machine reconstitue, elle ne transige pas.
 */
async function resolveTradeWindow(season: string, enforce: boolean): Promise<TradeWindow> {
  if (!enforce) return { open: true, label: "" };

  const phases = await getSeasonPhases(season);
  const deadline = phases.find((p) => p.phase === "trade_deadline");
  const playoffs = phases.find((p) => p.phase === "playoffs");
  if (!deadline) return { open: true, label: "" };

  const today = new Date().toISOString().slice(0, 10);
  const seasonOver = playoffs ? today > playoffs.endsOn : false;
  if (today <= deadline.endsOn || seasonOver) return { open: true, label: "" };

  return {
    open: false,
    label:
      `La trade deadline est passée (${formatPhaseDate(deadline.startsOn)})` +
      `${deadline.isEstimated ? ", date estimée" : ""} : aucun échange n'est possible avant ` +
      `l'intersaison. La simulation reste utilisable, mais elle ne serait pas validée par la ligue.`,
  };
}

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{
    season?: string;
    teams?: string;
    moves?: string;
    picks?: string;
    cash?: string;
    flags?: string;
    tpe?: string;
  }>;
}) {
  // Deuxième verrou : le middleware renvoie déjà un 404 sur cette route quand le
  // drapeau est éteint. Si son matcher change un jour, la page refuse quand même
  // de lire les données plutôt que de s'afficher par accident.
  if (!TRADE_MACHINE_ENABLED) notFound();

  const params = await searchParams;
  const leagueState = await getLeagueState();
  const { currentSeason, statsSeason } = leagueState;
  const season = params.season || currentSeason;
  const capLevels = await getCapLevels(season);
  const supabase = await createClient();

  const [{ data: seasonRows }, { data: rows }, { data: payrolls }] = await Promise.all([
    supabase.from("standings").select("season").order("season", { ascending: false }).limit(1000),
    supabase
      .from("rosters")
      .select(
        "player_id, first_name, last_name, team_tricode, team_city, team_name, position, age, salary, pts, reb, ast"
      )
      .eq("season", season),
    supabase.from("team_payrolls").select("team_tricode, payroll").eq("season", season),
  ]);

  const availableSeasons = buildSeasonOptions(
    (seasonRows || []).map((r: { season: string }) => r.season),
    currentSeason,
    season
  );
  const statuses = Object.fromEntries(
    availableSeasons.map((s) => [s, seasonStatusLabel(seasonStatus(s, leagueState))])
  );

  const roster: TradeRosterPlayer[] = ((rows || []) as RosterRow[]).map((r) => ({
    player_id: r.player_id,
    first_name: r.first_name,
    last_name: r.last_name,
    team_tricode: r.team_tricode,
    team_city: r.team_city,
    team_name: r.team_name,
    position: r.position ?? "",
    age: r.age,
    salary: parseSalaryOrNull(r.salary),
    pts: r.pts,
    reb: r.reb,
    ast: r.ast,
  }));

  // ── Statistiques de référence ──
  // Une saison qui n'a pas commencé n'a aucune moyenne par match : la balance
  // sportive de l'échange serait à zéro pendant toute l'intersaison. On reprend
  // donc les moyennes de la dernière saison jouée, en l'affichant clairement.
  let statsFromSeason: string | null = null;
  const hasOwnStats = roster.some((p) => p.pts != null && p.pts > 0);
  if (!hasOwnStats && statsSeason !== season) {
    const { data: refRows } = await supabase
      .from("rosters")
      .select("player_id, pts, reb, ast")
      .eq("season", statsSeason);

    const ref = new Map((refRows || []).map((r) => [r.player_id, r]));
    let matched = 0;
    for (const p of roster) {
      const r = ref.get(p.player_id);
      if (!r) continue;
      p.pts = r.pts;
      p.reb = r.reb;
      p.ast = r.ast;
      matched++;
    }
    if (matched > 0) statsFromSeason = statsSeason;
  }

  // Masse salariale de départ : la somme des contrats de l'effectif, remplacée
  // par les totaux officiels (qui incluent le dead money et les cap holds)
  // uniquement s'ils couvrent les 30 équipes. Une série partielle mélangerait
  // deux façons de compter d'une équipe à l'autre.
  const payrollBase: Record<string, number> = {};
  for (const p of roster) {
    payrollBase[p.team_tricode] = (payrollBase[p.team_tricode] ?? 0) + (p.salary ?? 0);
  }
  const officialPayrolls = (payrolls || []).filter((p) => p.payroll > 0);
  if (officialPayrolls.length >= NBA_TEAM_COUNT) {
    for (const p of officialPayrolls) payrollBase[p.team_tricode] = p.payroll;
  }

  // ── Fenêtre d'échange ──
  // Rien ne se signe entre la date limite et la fin de la saison. La contrainte
  // ne vaut que pour la saison en cours : sur une saison passée, l'échange est
  // une reconstitution, pas une transaction.
  const tradeWindow = await resolveTradeWindow(season, season === currentSeason);

  // État initial relu depuis l'URL, pour que les échanges soient partageables.
  const ownerById = new Map(roster.map((p) => [p.player_id, p.team_tricode]));
  const tricodes = [...new Set(roster.map((p) => p.team_tricode))].sort();
  const pickOwnerById = new Map(
    buildPickInventory(tricodes, season).map((p) => [p.id, p.owner])
  );
  const {
    teams: initialTeams,
    moves: initialMoves,
    pickMoves: initialPickMoves,
    cash: initialCash,
    flags: initialFlags,
    tradeExceptions: initialTradeExceptions,
  } = decodeTrade(
    params,
    (id) => ownerById.get(id),
    (pickId) => pickOwnerById.get(pickId)
  );

  const missingSalaries = roster.filter((p) => p.salary == null).length;

  return (
    <SeasonTransitionProvider>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageBanner
          title="Trade Machine"
          subtitle="Joueurs, picks et cash, jusqu'à cinq équipes — et le verdict de la convention collective"
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
              {missingSalaries > 0 && (
                <span className="inline-flex items-center border border-amber-500 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-500">
                  <span className="tnum">{missingSalaries}</span>&nbsp;contrats manquants
                </span>
              )}
            </div>
          }
        />

        <SeasonContent>
          <ScrollReveal variant="up" delay={100}>
            <TradeMachine
              season={season}
              roster={roster}
              payrollBase={payrollBase}
              initialTeams={initialTeams}
              initialMoves={initialMoves}
              initialPickMoves={initialPickMoves}
              initialCash={initialCash}
              initialFlags={initialFlags}
              initialTradeExceptions={initialTradeExceptions}
              statsFromSeason={statsFromSeason}
              thresholds={capLevels}
              window={tradeWindow}
            />
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
