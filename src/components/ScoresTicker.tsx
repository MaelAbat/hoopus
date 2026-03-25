"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X, Trophy } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";

interface Game {
  game_id: string;
  game_date: string;
  status: number;
  status_text: string;
  home_team: string;
  home_team_name: string;
  home_score: number;
  away_team: string;
  away_team_name: string;
  away_score: number;
}

function MiniScore({ game }: { game: Game }) {
  const isFinal = game.status === 3;
  const isLive = game.status === 2;
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-card border border-border-t px-3 py-2 shrink-0 min-w-[180px] transition-colors hover:border-border-hover">
      {/* Away */}
      <div className="flex flex-col items-center gap-0.5 w-10">
        <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="h-5 w-5 object-contain" />
        <span className={`text-[10px] font-bold ${awayWon ? "text-text-primary" : "text-text-muted"}`}>
          {game.away_team}
        </span>
      </div>

      {/* Score */}
      <div className="flex flex-col items-center">
        {isFinal || isLive ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-bold tabular-nums ${awayWon ? "text-text-primary" : "text-text-muted"}`}>
                {game.away_score}
              </span>
              <span className="text-[10px] text-text-faint">-</span>
              <span className={`text-sm font-bold tabular-nums ${homeWon ? "text-text-primary" : "text-text-muted"}`}>
                {game.home_score}
              </span>
            </div>
            <span className={`text-[9px] font-medium mt-0.5 ${isLive ? "text-red-400" : "text-text-faint"}`}>
              {isLive ? "LIVE" : "Final"}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-text-muted">{game.status_text}</span>
        )}
      </div>

      {/* Home */}
      <div className="flex flex-col items-center gap-0.5 w-10">
        <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="h-5 w-5 object-contain" />
        <span className={`text-[10px] font-bold ${homeWon ? "text-text-primary" : "text-text-muted"}`}>
          {game.home_team}
        </span>
      </div>
    </div>
  );
}

export default function ScoresTicker({ games }: { games: Game[] }) {
  const [visible, setVisible] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate visibility from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("ticker-visible");
    if (stored === "false") setVisible(false);
    setHydrated(true);
  }, []);

  function toggle() {
    const next = !visible;
    setVisible(next);
    localStorage.setItem("ticker-visible", String(next));
  }

  function scroll(dir: -1 | 1) {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  }

  if (!hydrated) return null;
  if (games.length === 0) return null;

  // Collapsed state: small toggle button
  if (!visible) {
    return (
      <div className="mb-4">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 rounded-lg bg-card border border-border-t px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:border-border-hover transition-colors"
        >
          <Trophy size={12} />
          Scores de la nuit
          <ChevronRight size={12} />
        </button>
      </div>
    );
  }

  // Find the date label
  const dateStr = games[0]?.game_date;
  const dateLabel = dateStr
    ? new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "Derniers scores";

  return (
    <div className="mb-4 rounded-xl bg-card/60 border border-border-t overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-t/50">
        <div className="flex items-center gap-2">
          <Trophy size={13} className="text-accent" />
          <span className="text-xs font-semibold text-text-primary capitalize">{dateLabel}</span>
          <span className="text-[10px] text-text-faint">{games.length} match{games.length > 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll(-1)}
            className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-input transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => scroll(1)}
            className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-input transition-colors"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={toggle}
            className="rounded-md p-1 ml-1 text-text-faint hover:text-text-primary hover:bg-input transition-colors"
            title="Masquer les scores"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Scores row */}
      <div
        ref={scrollRef}
        className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar"
      >
        {games.map((game) => (
          <MiniScore key={game.game_id} game={game} />
        ))}
      </div>
    </div>
  );
}
