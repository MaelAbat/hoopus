import { createClient } from "@/lib/supabase/server";
import { syncBoxscore } from "@/lib/sync-boxscore";
import { getHighlightVideoId } from "@/lib/youtube";
import BoxScore from "@/components/BoxScore";
import FloatingVideo from "@/components/FloatingVideo";
import ScrollReveal from "@/components/ScrollReveal";
import ScrollToTop from "@/components/ScrollToTop";
import { teamLogoUrl } from "@/lib/nba-teams";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ gameId: string }>;
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
          <p className="text-text-muted">Aucune donnee disponible pour ce match.</p>
          <p className="text-xs text-text-faint mt-2">Le match n&apos;a peut-etre pas encore eu lieu ou les donnees ne sont pas disponibles.</p>
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

  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;

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
        <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
          <div className="px-4 py-6 sm:px-10 sm:py-10">
            <div className="flex items-center justify-center gap-4 sm:gap-12">
              {/* Away team */}
              <div className="flex flex-col items-center gap-2 sm:gap-3">
                <img src={teamLogoUrl(awayTeam)} alt={awayTeam} className="h-12 w-12 sm:h-20 sm:w-20 object-contain" />
                <div className="text-center">
                  <p className={`text-sm sm:text-lg font-bold ${awayWon ? "text-text-primary" : "text-text-muted"}`}>
                    <span className="hidden sm:inline">{gameData?.away_team_name || awayTeam}</span>
                    <span className="sm:hidden">{awayTeam}</span>
                  </p>
                  <p className="text-xs text-text-faint hidden sm:block">{awayTeam}</p>
                </div>
              </div>

              {/* Score */}
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <div className="flex items-center gap-2 sm:gap-4">
                  <span className={`text-3xl sm:text-5xl font-extrabold tabular-nums ${awayWon ? "text-text-primary" : "text-text-muted"}`}>
                    {awayScore}
                  </span>
                  <span className="text-lg sm:text-xl text-text-faint font-light">-</span>
                  <span className={`text-3xl sm:text-5xl font-extrabold tabular-nums ${homeWon ? "text-text-primary" : "text-text-muted"}`}>
                    {homeScore}
                  </span>
                </div>
                <span className="text-xs font-medium text-text-faint uppercase tracking-wider">
                  {gameData?.status === 3 ? "Final" : gameData?.status === 2 ? "En cours" : gameData?.status_text || ""}
                </span>
                {gameDate && (
                  <p className="text-xs text-text-faint capitalize">{gameDate}</p>
                )}
                {gameData?.arena && (
                  <p className="text-[11px] text-text-faint">{gameData.arena} - {gameData.arena_city}</p>
                )}
              </div>

              {/* Home team */}
              <div className="flex flex-col items-center gap-2 sm:gap-3">
                <img src={teamLogoUrl(homeTeam)} alt={homeTeam} className="h-12 w-12 sm:h-20 sm:w-20 object-contain" />
                <div className="text-center">
                  <p className={`text-sm sm:text-lg font-bold ${homeWon ? "text-text-primary" : "text-text-muted"}`}>
                    <span className="hidden sm:inline">{gameData?.home_team_name || homeTeam}</span>
                    <span className="sm:hidden">{homeTeam}</span>
                  </p>
                  <p className="text-xs text-text-faint hidden sm:block">{homeTeam}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
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
