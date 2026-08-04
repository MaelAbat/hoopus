import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { OG_IMAGE } from "@/lib/seo";
import { seasonFromStartYear } from "@/lib/season";
import DraftIndexTable, { type DraftIndexRow } from "@/components/DraftIndexTable";
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

  const favouriteByYear = new Map<number, LotteryFavourite>();
  for (const row of (favourites || []) as LotteryFavourite[]) {
    favouriteByYear.set(row.draft_year, row);
  }

  const rows: DraftIndexRow[] = ((topPicks || []) as PickRow[])
    .filter((row) => byYear.has(row.draft_year))
    .map((row) => {
      const favourite = favouriteByYear.get(row.draft_year);
      return {
        draftYear: row.draft_year,
        season: seasonFromStartYear(row.draft_year),
        teamTricode: row.team_tricode,
        playerName: row.player_name,
        playerId: row.player_id,
        college: row.college,
        pickCount: byYear.get(row.draft_year) ?? 0,
        favourite: favourite
          ? {
              teamTricode: favourite.team_tricode,
              wins: favourite.wins,
              losses: favourite.losses,
              oddsTop1: favourite.odds_top1,
            }
          : null,
      };
    });

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

            <DraftIndexTable rows={rows} />
          </section>
        </ScrollReveal>
      )}
    </div>
  );
}
