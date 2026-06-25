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
    <div className="relative bg-card border border-rule overflow-hidden">
      {/* Top status rail — broadcast lower-third */}
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5 sm:px-6">
        <span className="kicker text-text-faint">Feuille de match</span>
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 bg-accent px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
            <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
            {statusLabel}
          </span>
        ) : (
          <span className="kicker text-text-muted">{statusLabel}</span>
        )}
      </div>

      <div className="px-4 py-7 sm:px-10 sm:py-12">
        <div className="flex items-center justify-center gap-4 sm:gap-12">
          {/* Away team */}
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <img src={teamLogoUrl(awayTeam)} alt={awayTeam} className="h-12 w-12 sm:h-20 sm:w-20 object-contain" />
            <div className="text-center">
              <p className={`font-display text-lg sm:text-2xl ${awayWon ? "text-text-primary" : "text-text-muted"}`}>
                <span className="hidden sm:inline">{awayTeamName}</span>
                <span className="sm:hidden">{awayTeam}</span>
              </p>
              <p className="kicker text-text-faint hidden sm:block">{awayTeam}</p>
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <div className="flex items-end gap-2 sm:gap-5">
              <span className={`font-display tnum text-5xl sm:text-7xl leading-none ${awayWon ? "text-text-primary" : "text-text-muted"}`}>
                {awayScore}
              </span>
              <span className="mb-1 text-lg sm:text-2xl text-text-faint">–</span>
              <span className={`font-display tnum text-5xl sm:text-7xl leading-none ${homeWon ? "text-text-primary" : "text-text-muted"}`}>
                {homeScore}
              </span>
            </div>
            {gameDate && <p className="kicker text-text-faint capitalize">{gameDate}</p>}
            {arena && (
              <p className="font-mono text-[11px] uppercase tracking-wider text-text-faint">
                {arena}
                {arenaCity ? ` · ${arenaCity}` : ""}
              </p>
            )}
          </div>

          {/* Home team */}
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <img src={teamLogoUrl(homeTeam)} alt={homeTeam} className="h-12 w-12 sm:h-20 sm:w-20 object-contain" />
            <div className="text-center">
              <p className={`font-display text-lg sm:text-2xl ${homeWon ? "text-text-primary" : "text-text-muted"}`}>
                <span className="hidden sm:inline">{homeTeamName}</span>
                <span className="sm:hidden">{homeTeam}</span>
              </p>
              <p className="kicker text-text-faint hidden sm:block">{homeTeam}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
