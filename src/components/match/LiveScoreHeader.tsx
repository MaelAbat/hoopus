"use client";

import { useLiveScores } from "@/lib/useLiveScores";
import { teamLogoUrl } from "@/lib/nba-teams";

interface Props {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  awayTeamName: string;
  homeTeamName: string;
  initialAwayScore: number;
  initialHomeScore: number;
  initialStatus: number;
  initialStatusText: string | null;
  gameDate: string;
  arena: string | null;
  arenaCity: string | null;
}

export default function LiveScoreHeader({
  gameId,
  awayTeam,
  homeTeam,
  awayTeamName,
  homeTeamName,
  initialAwayScore,
  initialHomeScore,
  initialStatus,
  initialStatusText,
  gameDate,
  arena,
  arenaCity,
}: Props) {
  // Always poll while the page is open: a scheduled game can flip to live, and
  // a "final" render might be stale if we loaded the page before the game started.
  // For truly-final games the endpoint just reads the DB (syncBoxscore is gated on status === 2).
  const updates = useLiveScores([gameId], true);
  const live = updates.get(gameId);

  const awayScore = live?.away_score ?? initialAwayScore;
  const homeScore = live?.home_score ?? initialHomeScore;
  const status = live?.status ?? initialStatus;
  const statusText = live?.status_text ?? initialStatusText ?? "";

  const homeWon = status === 3 && homeScore > awayScore;
  const awayWon = status === 3 && awayScore > homeScore;
  const isLive = status === 2;

  const statusLabel = status === 3 ? "Terminé" : isLive ? statusText || "En cours" : statusText;

  return (
    <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
      <div className="px-4 py-6 sm:px-10 sm:py-10">
        <div className="flex items-center justify-center gap-4 sm:gap-12">
          {/* Away team */}
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <img src={teamLogoUrl(awayTeam)} alt={awayTeam} className="h-12 w-12 sm:h-20 sm:w-20 object-contain" />
            <div className="text-center">
              <p className={`text-sm sm:text-lg font-bold ${awayWon ? "text-text-primary" : "text-text-muted"}`}>
                <span className="hidden sm:inline">{awayTeamName}</span>
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
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-400 uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                {statusLabel}
              </span>
            ) : (
              <span className="text-xs font-medium text-text-faint uppercase tracking-wider">
                {statusLabel}
              </span>
            )}
            {gameDate && <p className="text-xs text-text-faint capitalize">{gameDate}</p>}
            {arena && (
              <p className="text-[11px] text-text-faint">
                {arena}
                {arenaCity ? ` - ${arenaCity}` : ""}
              </p>
            )}
          </div>

          {/* Home team */}
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <img src={teamLogoUrl(homeTeam)} alt={homeTeam} className="h-12 w-12 sm:h-20 sm:w-20 object-contain" />
            <div className="text-center">
              <p className={`text-sm sm:text-lg font-bold ${homeWon ? "text-text-primary" : "text-text-muted"}`}>
                <span className="hidden sm:inline">{homeTeamName}</span>
                <span className="sm:hidden">{homeTeam}</span>
              </p>
              <p className="text-xs text-text-faint hidden sm:block">{homeTeam}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
