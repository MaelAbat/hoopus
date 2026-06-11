import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import PlayerCompare from "@/components/PlayerCompare";

export const revalidate = 3600;

export const metadata = {
  title: "Comparer des joueurs NBA",
  description:
    "Comparez deux joueurs NBA côte à côte : statistiques de carrière, moyennes et progression saison par saison. L'outil de comparaison Hoopus.",
  alternates: { canonical: "/joueurs/comparer" },
  openGraph: {
    title: "Comparer des joueurs NBA · Hoopus",
    description: "Deux joueurs côte à côte : stats de carrière et progression.",
  },
};

interface CareerStat {
  player_id: number;
  season: string;
  team: string;
  gp: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
  min: number;
  ts_pct: number;
  efg_pct: number;
}

export interface ComparePlayer {
  player_id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  team_tricode: string | null;
  height: string | null;
  weight: string | null;
  country: string | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
}

export interface CompareData {
  player: ComparePlayer;
  career: CareerStat[];
}

export default async function ComparerPage({
  searchParams,
}: {
  searchParams: Promise<{ p1?: string; p2?: string; p3?: string }>;
}) {
  const params = await searchParams;
  const ids = [params.p1, params.p2, params.p3]
    .filter((id): id is string => !!id)
    .map(Number)
    .filter((id) => !isNaN(id));

  let playersData: CompareData[] = [];

  if (ids.length > 0) {
    const supabase = await createClient();

    const [{ data: players }, { data: careerStats }] = await Promise.all([
      supabase
        .from("players")
        .select("player_id, first_name, last_name, position, team_tricode, height, weight, country, pts, reb, ast")
        .in("player_id", ids),
      supabase
        .from("player_career_stats")
        .select("player_id, season, team, gp, pts, reb, ast, stl, blk, fg_pct, fg3_pct, ft_pct, min, ts_pct, efg_pct")
        .in("player_id", ids)
        .order("season", { ascending: true }),
    ]);

    if (players) {
      // Maintain the order from URL params
      playersData = ids
        .map((id) => {
          const player = players.find((p) => p.player_id === id);
          if (!player) return null;
          const career = (careerStats || []).filter((c) => c.player_id === id);
          return { player, career } as CompareData;
        })
        .filter((d): d is CompareData => d !== null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageBanner
        title="Comparateur de joueurs"
        subtitle="Comparez les statistiques de 2 ou 3 joueurs NBA côte à côte"
        variant="compare"
      />

      <ScrollReveal variant="up" delay={100}>
        <Link
          href="/joueurs"
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-input hover:text-text-primary"
        >
          <ChevronLeft size={16} /> Tous les joueurs
        </Link>
      </ScrollReveal>

      <ScrollReveal variant="up" delay={200}>
        <PlayerCompare initialData={playersData} />
      </ScrollReveal>
    </div>
  );
}
