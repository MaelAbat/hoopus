import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { OG_IMAGE } from "@/lib/seo";
import { seasonFromStartYear } from "@/lib/season";
import { teamLogoUrl, teamNickname } from "@/lib/nba-teams";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";

export const revalidate = 3600;

export const metadata = {
  title: "Drafts NBA",
  description:
    "Toutes les drafts NBA archivées sur Hoopus : premier choix, tour par tour, et la grille de loterie de chaque année.",
  alternates: { canonical: "/draft" },
  openGraph: {
    title: "Drafts NBA · Hoopus",
    description: "Le premier choix de chaque draft, et le détail des deux tours.",
    images: [OG_IMAGE],
  },
};

interface PickRow {
  draft_year: number;
  pick_overall: number;
  team_tricode: string;
  player_name: string | null;
  player_id: number | null;
  college: string | null;
}

interface LotteryFavourite {
  draft_year: number;
  team_tricode: string;
  odds_top1: number | null;
  wins: number | null;
  losses: number | null;
}

export default async function DraftIndexPage() {
  const supabase = await createClient();

  // Deux lectures ciblées plutôt qu'un balayage : les premiers choix pour la
  // vitrine, les rangs pour compter les choix de chaque année.
  const [{ data: topPicks }, counts, { data: favourites }] = await Promise.all([
    supabase
      .from("draft_picks")
      .select("draft_year, pick_overall, team_tricode, player_name, player_id, college")
      .eq("pick_overall", 1)
      .order("draft_year", { ascending: false }),
    // Une soixantaine de choix par draft : le millier de lignes que PostgREST
    // sert d'un coup est franchi dès la dix-septième année archivée.
    fetchAllRows<{ draft_year: number }>(
      (from, to) =>
        supabase
          .from("draft_picks")
          .select("draft_year")
          .order("draft_year", { ascending: false })
          .order("pick_overall", { ascending: true })
          .range(from, to),
      { label: "rangs de draft" }
    ),
    // L'équipe qui partait avec les meilleures chances, année par année : une
    // ligne par loterie, celle du pire bilan de la saison précédente.
    supabase
      .from("draft_lottery")
      .select("draft_year, team_tricode, odds_top1, wins, losses")
      .eq("pre_lottery_rank", 1),
  ]);

  const byYear = new Map<number, number>();
  for (const row of counts) {
    byYear.set(row.draft_year, (byYear.get(row.draft_year) || 0) + 1);
  }

  const rows = ((topPicks || []) as PickRow[]).filter((row) => byYear.has(row.draft_year));

  const favouriteByYear = new Map<number, LotteryFavourite>();
  for (const row of (favourites || []) as LotteryFavourite[]) {
    favouriteByYear.set(row.draft_year, row);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Draft"
        subtitle="Chaque draft, ses deux tours et la grille de loterie qui l'a précédée"
        variant="players"
        extra={
          <Link
            href="/marche"
            className="inline-flex items-center border border-rule px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Retour au marché
          </Link>
        }
      />

      {rows.length === 0 ? (
        <div className="border border-rule bg-card px-6 py-16 text-center">
          <p className="font-display text-2xl text-text-primary">Aucune draft archivée</p>
          <p className="mt-2 text-sm text-text-muted">
            Lancez la synchronisation du marché pour remplir l&apos;historique.
          </p>
        </div>
      ) : (
        <ScrollReveal variant="up" delay={100}>
          <section className="border border-rule bg-card">
            <header className="flex items-center justify-between border-b border-rule bg-input/50 px-4 py-2.5">
              <h2 className="kicker text-text-muted">Année par année</h2>
              <span className="tnum font-mono text-[10px] uppercase tracking-wider text-text-faint">
                {rows.length} drafts
              </span>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-rule bg-input/30 text-left">
                    <th className="w-20 px-4 py-1.5 kicker text-text-faint">Draft</th>
                    <th className="px-3 py-1.5 kicker text-text-faint">Premier choix</th>
                    <th className="px-3 py-1.5 kicker text-text-faint">Par</th>
                    <th className="px-3 py-1.5 kicker text-text-faint">Meilleures chances à la loterie</th>
                    <th className="px-3 py-1.5 kicker text-text-faint text-right">Choix</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.draft_year} className="border-t border-rule transition-colors hover:bg-card-hover">
                      <td className="px-4 py-2">
                        <Link
                          href={`/draft/${seasonFromStartYear(row.draft_year)}`}
                          className="tnum font-mono text-xs font-bold text-text-primary transition-colors hover:text-accent"
                        >
                          {row.draft_year}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        {row.player_id ? (
                          <Link
                            href={`/joueurs/${row.player_id}`}
                            className="text-sm font-semibold text-text-primary underline decoration-rule underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
                          >
                            {row.player_name}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold text-text-primary">
                            {row.player_name ?? "Choix non exercé"}
                          </span>
                        )}
                        {row.college && (
                          <span className="ml-2 text-[11px] text-text-faint">{row.college}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <img src={teamLogoUrl(row.team_tricode)} alt="" className="h-5 w-5 object-contain" />
                          <span className="text-sm text-text-muted">{teamNickname(row.team_tricode)}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {(() => {
                          const favourite = favouriteByYear.get(row.draft_year);
                          if (!favourite) {
                            return <span className="text-[11px] italic text-text-faint">grille indisponible</span>;
                          }
                          return (
                            <span className="flex items-center gap-2">
                              <img
                                src={teamLogoUrl(favourite.team_tricode)}
                                alt=""
                                className="h-4 w-4 object-contain"
                              />
                              <span className="text-[11px] text-text-muted">
                                {teamNickname(favourite.team_tricode)}
                              </span>
                              <span className="tnum font-mono text-[10px] text-text-faint">
                                {favourite.wins}–{favourite.losses}
                                {favourite.odds_top1 != null ? ` · ${favourite.odds_top1} %` : ""}
                              </span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/draft/${seasonFromStartYear(row.draft_year)}`}
                          className="tnum font-mono text-xs text-text-muted transition-colors hover:text-accent"
                        >
                          {byYear.get(row.draft_year)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </ScrollReveal>
      )}
    </div>
  );
}
