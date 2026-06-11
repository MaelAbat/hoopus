import { createClient } from "@/lib/supabase/server";
import { syncBoxscore } from "@/lib/sync-boxscore";
import { getHighlightVideoId } from "@/lib/youtube";
import BoxScore from "@/components/BoxScore";
import TeamStatsComparison from "@/components/TeamStatsComparison";
import FloatingVideo from "@/components/FloatingVideo";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollToTop from "@/components/ScrollToTop";
import LiveScoreHeader from "@/components/match/LiveScoreHeader";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { createClient as createMatchClient } from "@/lib/supabase/server";
import { OG_IMAGE } from "@/lib/seo";

export const revalidate = 60;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoopus.fr";

interface PageProps {
  params: Promise<{ gameId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameId } = await params;
  const supabase = await createMatchClient();
  const { data: game } = await supabase
    .from("games")
    .select("home_team_name, away_team_name, home_score, away_score, game_date, status")
    .eq("game_id", gameId)
    .single();

  if (!game?.home_team_name || !game?.away_team_name) {
    return { title: "Match NBA", description: "Feuille de match NBA : box score et statistiques détaillées sur Hoopus." };
  }

  const finished = game.status === 3 && game.home_score != null && game.away_score != null;
  const title = finished
    ? `${game.away_team_name} ${game.away_score} - ${game.home_score} ${game.home_team_name}`
    : `${game.away_team_name} – ${game.home_team_name}`;
  const description = finished
    ? `Résultat et box score complet de ${game.away_team_name} contre ${game.home_team_name} : statistiques joueur par joueur sur Hoopus.`
    : `Suivez ${game.away_team_name} contre ${game.home_team_name} en direct : score, box score et statistiques sur Hoopus.`;

  return {
    title,
    description,
    alternates: { canonical: `/match/${gameId}` },
    openGraph: { title: `${title} · Hoopus`, description, type: "article", url: `${siteUrl}/match/${gameId}`, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: `${title} · Hoopus`, description },
  };
}

export default async function MatchPage({ params }: PageProps) {
  const { gameId } = await params;

  // Sync boxscore on-demand (fetches from NBA CDN if not in DB)
  await syncBoxscore(gameId);

  const supabase = await createClient();

  // Fetch boxscore data
  const { data: players } = await supabase
    .from("boxscores")
    .select("*")
    .eq("game_id", gameId)
    .order("starter", { ascending: false })
    .order("minutes", { ascending: false });

  // Fetch game info
  const { data: gameData } = await supabase
    .from("games")
    .select("*")
    .eq("game_id", gameId)
    .single();

  // Deduplicate players (keep first occurrence per player_id)
  const seen = new Set<number>();
  const uniquePlayers = (players || []).filter((p) => {
    if (seen.has(p.player_id)) return false;
    seen.add(p.player_id);
    return true;
  });

  if (uniquePlayers.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <Link href="/calendrier" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={16} />
          Retour au calendrier
        </Link>
        <div className="rounded-2xl bg-card border border-border-t p-12 text-center">
          <p className="text-text-muted">Aucune donnée disponible pour ce match.</p>
          <p className="text-xs text-text-faint mt-2">Le match n&apos;a peut-être pas encore eu lieu ou les données ne sont pas disponibles.</p>
        </div>
      </div>
    );
  }

  // Split by team
  const teams = [...new Set(uniquePlayers.map((p) => p.team))];
  const homeTeam = uniquePlayers.find((p) => p.is_home)?.team || teams[0];
  const awayTeam = teams.find((t) => t !== homeTeam) || teams[1];

  const homePlayers = uniquePlayers.filter((p) => p.team === homeTeam);
  const awayPlayers = uniquePlayers.filter((p) => p.team === awayTeam);

  const homeScore = gameData?.home_score ?? homePlayers.reduce((s, p) => s + (p.pts || 0), 0);
  const awayScore = gameData?.away_score ?? awayPlayers.reduce((s, p) => s + (p.pts || 0), 0);

  const gameDate = gameData?.game_date
    ? new Date(gameData.game_date + "T12:00:00").toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  // Fetch or resolve highlight video for finished games
  let highlightVideoId: string | null = null;
  if (gameData?.status === 3) {
    highlightVideoId = gameData.highlight_video_id ?? null;
    if (!highlightVideoId && gameData.game_date) {
      highlightVideoId = await getHighlightVideoId(
        gameId,
        gameData.away_team_name || awayTeam,
        gameData.home_team_name || homeTeam,
        gameData.game_date
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ScrollToTop />
      <Link href="/calendrier" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft size={16} />
        Retour au calendrier
      </Link>

      {/* Score header */}
      <ScrollReveal variant="scale">
        <LiveScoreHeader
          gameId={gameId}
          awayTeam={awayTeam}
          homeTeam={homeTeam}
          awayTeamName={gameData?.away_team_name || awayTeam}
          homeTeamName={gameData?.home_team_name || homeTeam}
          initialAwayScore={awayScore}
          initialHomeScore={homeScore}
          initialStatus={gameData?.status ?? 0}
          initialStatusText={gameData?.status_text ?? null}
          gameDate={gameDate}
          arena={gameData?.arena ?? null}
          arenaCity={gameData?.arena_city ?? null}
        />
      </ScrollReveal>

      {/* Team stats comparison */}
      <ScrollReveal variant="up" delay={80}>
        <TeamStatsComparison
          awayTeam={awayTeam}
          homeTeam={homeTeam}
          awayPlayers={awayPlayers}
          homePlayers={homePlayers}
        />
      </ScrollReveal>

      {/* Box scores */}
      <ScrollReveal variant="up" delay={100}>
        <BoxScore
          awayTeam={awayTeam}
          homeTeam={homeTeam}
          awayTeamName={gameData?.away_team_name || awayTeam}
          homeTeamName={gameData?.home_team_name || homeTeam}
          awayPlayers={awayPlayers}
          homePlayers={homePlayers}
        />
      </ScrollReveal>

      {/* Highlight video */}
      {highlightVideoId && (
        <ScrollReveal variant="up" delay={150}>
          <FloatingVideo videoId={highlightVideoId} />
        </ScrollReveal>
      )}
    </div>
  );
}
