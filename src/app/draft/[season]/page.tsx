import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OG_IMAGE } from "@/lib/seo";
import { seasonBefore, seasonStartYear } from "@/lib/season";
import { teamNickname } from "@/lib/nba-teams";
import TeamMark from "@/components/TeamMark";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";

export const revalidate = 3600;

interface DraftPick {
  pick_overall: number;
  round: number;
  pick_in_round: number | null;
  team_tricode: string;
  player_name: string | null;
  player_id: number | null;
  college: string | null;
}

interface LotteryTeam {
  team_tricode: string;
  pre_lottery_rank: number;
  wins: number | null;
  losses: number | null;
  odds_top1: number | null;
  tied: boolean;
}

function isSeason(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

export async function generateMetadata({ params }: { params: Promise<{ season: string }> }) {
  const { season } = await params;
  if (!isSeason(season)) return {};
  const year = seasonStartYear(season);
  return {
    title: `Draft NBA ${year}`,
    description: `Tous les choix de la draft NBA ${year}, tour par tour, avec la grille de la loterie qui l'a précédée. En français, sur Hoopus.`,
    alternates: { canonical: `/draft/${season}` },
    openGraph: {
      title: `Draft NBA ${year} · Hoopus`,
      description: `Les deux tours de la draft ${year} et la grille de loterie.`,
      images: [OG_IMAGE],
    },
  };
}

export default async function DraftSeasonPage({ params }: { params: Promise<{ season: string }> }) {
  const { season } = await params;
  if (!isSeason(season)) notFound();

  const draftYear = seasonStartYear(season);
  const supabase = await createClient();

  const [{ data: picks }, { data: lottery }, { count: marketEvents }] = await Promise.all([
    supabase
      .from("draft_picks")
      .select("pick_overall, round, pick_in_round, team_tricode, player_name, player_id, college")
      .eq("draft_year", draftYear)
      .order("pick_overall"),
    supabase
      .from("draft_lottery")
      .select("team_tricode, pre_lottery_rank, wins, losses, odds_top1, tied")
      .eq("draft_year", draftYear)
      .order("pre_lottery_rank"),
    // Les drafts remontent à 1950, le marché à 2015-16 : inutile de proposer un
    // lien vers une page de mouvements qui n'existent pas.
    supabase.from("league_events").select("*", { count: "exact", head: true }).eq("season", season),
  ]);

  const rows = (picks || []) as DraftPick[];
  const board = (lottery || []) as LotteryTeam[];
  // Tri numérique explicite : `sort()` compare des chaînes, ce qui donnait
  // 1, 10, 11, 12, 2… sur les drafts d'avant 1989, qui comptaient jusqu'à
  // vingt-et-un tours.
  const rounds = [...new Set(rows.map((p) => p.round))].sort((a, b) => a - b);
  const firstPick = rows.find((p) => p.pick_overall === 1);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title={`Draft ${draftYear}`}
        subtitle={
          firstPick?.player_name
            ? `${firstPick.player_name} en tête — la promotion qui ouvre la saison ${season}`
            : `Les choix de la draft ${draftYear}, qui ouvre la saison ${season}`
        }
        variant="players"
        extra={
          <div className="flex flex-wrap items-center gap-3">
            {(marketEvents ?? 0) > 0 && (
              <Link
                href={`/marche?season=${season}`}
                className="inline-flex items-center border border-rule px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-accent hover:text-accent"
              >
                Marché {season}
              </Link>
            )}
            <Link
              href="/draft"
              className="inline-flex items-center border border-rule px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              Toutes les drafts
            </Link>
            {rows.length > 0 && (
              <span className="tnum kicker text-text-faint">{rows.length} choix</span>
            )}
          </div>
        }
      />

      {rows.length === 0 ? (
        <div className="border border-rule bg-card px-6 py-16 text-center">
          <p className="font-display text-2xl text-text-primary">Draft non renseignée</p>
          <p className="mt-2 text-sm text-text-muted">
            La draft {draftYear} n&apos;a pas encore été synchronisée, ou n&apos;a pas encore eu lieu.
          </p>
        </div>
      ) : (
        <ScrollReveal variant="up" delay={100}>
          <div className="space-y-6">
            {rounds.map((round) => (
              <section key={round} className="border border-rule bg-card">
                <header className="flex items-center justify-between border-b border-rule bg-input/50 px-4 py-2.5">
                  <h2 className="kicker text-text-muted">
                    {round === 1 ? "Premier tour" : round === 2 ? "Second tour" : `Tour ${round}`}
                  </h2>
                  <span className="tnum font-mono text-[10px] uppercase tracking-wider text-text-faint">
                    {rows.filter((p) => p.round === round).length} choix
                  </span>
                </header>

                {/* `table-fixed` et des largeurs explicites : chaque tour est un
                    tableau distinct, et sans cela chacun calculerait ses colonnes
                    d'après son propre contenu — les vingt tours de 1969 se
                    décalaient les uns par rapport aux autres. */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] table-fixed text-sm">
                    <thead>
                      <tr className="border-b border-rule bg-input/30 text-left">
                        <th className="w-16 px-4 py-1.5 kicker text-text-faint">Rang</th>
                        <th className="w-44 px-3 py-1.5 kicker text-text-faint">Équipe</th>
                        <th className="px-3 py-1.5 kicker text-text-faint">Joueur</th>
                        <th className="w-56 px-3 py-1.5 kicker text-text-faint">Université ou club</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows
                        .filter((p) => p.round === round)
                        .map((pick) => (
                          <tr key={pick.pick_overall} className="border-t border-rule transition-colors hover:bg-card-hover">
                            <td className="px-4 py-2">
                              <span className="tnum font-mono text-xs font-bold text-text-primary">
                                {pick.pick_overall}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="flex items-center gap-2">
                                <TeamMark tricode={pick.team_tricode} />
                                <span className="truncate text-sm text-text-primary">
                                  {teamNickname(pick.team_tricode)}
                                </span>
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {pick.player_name === null ? (
                                <span className="text-sm italic text-text-faint">Choix non exercé</span>
                              ) : pick.player_id ? (
                                <Link
                                  href={`/joueurs/${pick.player_id}`}
                                  className="text-sm font-semibold text-text-primary underline decoration-rule underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
                                >
                                  {pick.player_name}
                                </Link>
                              ) : (
                                <span className="block truncate text-sm font-semibold text-text-primary">
                                  {pick.player_name}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {/* Colonne de largeur fixe : les noms les plus longs
                                  sont coupés, et restent lisibles au survol. */}
                              <span
                                className="block truncate text-[11px] text-text-muted"
                                title={pick.college ?? undefined}
                              >
                                {pick.college || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

            {board.length > 0 && (
              <section className="border border-rule bg-card">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-input/50 px-4 py-2.5">
                  <h2 className="kicker text-text-muted">
                    Grille de la loterie — bilans {seasonBefore(season)}
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
                    {board.length} équipes
                  </span>
                </header>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[460px] text-sm">
                    <thead>
                      <tr className="border-b border-rule bg-input/30 text-left">
                        <th className="w-14 px-4 py-1.5 kicker text-text-faint">Rang</th>
                        <th className="px-3 py-1.5 kicker text-text-faint">Équipe</th>
                        <th className="px-3 py-1.5 kicker text-text-faint text-right">Bilan</th>
                        <th className="px-3 py-1.5 kicker text-text-faint text-right">1er choix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.map((row) => (
                        <tr key={row.team_tricode} className="border-t border-rule transition-colors hover:bg-card-hover">
                          <td className="px-4 py-2">
                            <span className="tnum font-mono text-xs font-bold text-text-primary">
                              {row.pre_lottery_rank}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <TeamMark tricode={row.team_tricode} />
                              <span className="text-sm text-text-primary">{teamNickname(row.team_tricode)}</span>
                              {row.tied && (
                                <span
                                  className="font-mono text-[10px] uppercase tracking-wider text-text-faint"
                                  title="Bilan à égalité : la ligue départage par tirage au sort."
                                >
                                  ex æquo
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="tnum font-mono text-xs text-text-muted">
                              {row.wins}–{row.losses}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="tnum font-mono text-xs font-bold text-text-primary">
                              {row.odds_top1 != null ? `${row.odds_top1} %` : "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="border-t border-rule px-4 py-3 text-[11px] leading-relaxed text-text-faint">
                  Cette grille donne les probabilités avant tirage, reconstruites depuis le classement
                  de {seasonBefore(season)} et les règles en vigueur cette année-là. Elle ne dit pas
                  quelle équipe est montée ou descendue : un choix peut avoir été échangé, et aucune
                  source ne permet de savoir à qui il appartenait au départ.
                </p>
              </section>
            )}
          </div>
        </ScrollReveal>
      )}
    </div>
  );
}
