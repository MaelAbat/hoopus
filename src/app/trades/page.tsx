import { createClient } from "@/lib/supabase/server";
import { OG_IMAGE } from "@/lib/seo";
import { getCurrentSeason } from "@/lib/season";
import { parseSalaryOrNull } from "@/lib/salary-cap";
import { decodeTrade, type TradeRosterPlayer } from "@/lib/trade-rules";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonSelector, { SeasonTransitionProvider, SeasonContent } from "@/components/SeasonSelector";
import TradeMachine from "@/components/TradeMachine";

export const revalidate = 3600;

export const metadata = {
  title: "Trade Machine NBA",
  description:
    "Simulez des échanges entre équipes NBA : concordance salariale, aprons, masse salariale avant et après. La trade machine Hoopus, en français.",
  alternates: { canonical: "/trades" },
  openGraph: {
    title: "Trade Machine NBA · Hoopus",
    description: "Construisez un échange entre 2 et 4 équipes et vérifiez s'il est légal.",
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

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; teams?: string; moves?: string }>;
}) {
  const params = await searchParams;
  const season = params.season || getCurrentSeason();
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

  const availableSeasons = [...new Set((seasonRows || []).map((r: { season: string }) => r.season))];
  if (!availableSeasons.includes(season)) availableSeasons.unshift(season);

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

  // Masse salariale de départ : le total officiel quand il existe (il inclut le
  // dead money et les cap holds), sinon la somme des contrats de l'effectif.
  const payrollBase: Record<string, number> = {};
  for (const p of roster) {
    payrollBase[p.team_tricode] = (payrollBase[p.team_tricode] ?? 0) + (p.salary ?? 0);
  }
  for (const p of payrolls || []) {
    if (p.payroll > 0) payrollBase[p.team_tricode] = p.payroll;
  }

  // État initial relu depuis l'URL, pour que les échanges soient partageables.
  const ownerById = new Map(roster.map((p) => [p.player_id, p.team_tricode]));
  const { teams: initialTeams, moves: initialMoves } = decodeTrade(
    params.teams,
    params.moves,
    (id) => ownerById.get(id)
  );

  const missingSalaries = roster.filter((p) => p.salary == null).length;

  return (
    <SeasonTransitionProvider>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageBanner
          title="Trade Machine"
          subtitle="Construisez un échange entre 2 et 4 équipes et vérifiez sa légalité"
          variant="teams"
          extra={
            <div className="flex flex-wrap items-center gap-3">
              <SeasonSelector current={season} available={availableSeasons} />
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
            />
          </ScrollReveal>
        </SeasonContent>
      </div>
    </SeasonTransitionProvider>
  );
}
