"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight, X, Trophy } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";
import { useFavorites } from "@/context/FavoritesContext";
import Link from "next/link";

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
  game_time?: string;
}

function toParisTime(gameDate: string, gameTime: string): string {
  if (!gameTime) return "";
  const timePart = gameTime.includes("T") ? gameTime.split("T")[1] : gameTime;
  const match = timePart.match(/^(\d{2}):(\d{2})/);
  if (!match) return "";
  const etHours = parseInt(match[1]);
  const etMinutes = parseInt(match[2]);
  const fakeUtc = new Date(Date.UTC(
    parseInt(gameDate.slice(0, 4)),
    parseInt(gameDate.slice(5, 7)) - 1,
    parseInt(gameDate.slice(8, 10)),
    etHours, etMinutes
  ));
  const etFormatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).format(fakeUtc);
  const etHourCheck = parseInt(etFormatted);
  const etOffset = etHourCheck - etHours;
  const realUtc = new Date(fakeUtc.getTime() - etOffset * 3600000);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(realUtc);
}

function MobileScore({ game, isFav }: { game: Game; isFav: boolean }) {
  const isFinal = game.status === 3;
  const isLive = game.status === 2;
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;

  return (
    <Link
      href={`/match/${game.game_id}`}
      className={`grid grid-cols-[1fr_auto_1fr] items-center rounded-xl bg-card border px-3 py-3 shrink-0 min-w-[220px] gap-3 transition-all duration-200 hover:border-border-hover hover:shadow-lg hover:-translate-y-0.5 ${
        isFav ? "border-accent/60 ring-2 ring-accent/20 shadow-[0_0_12px_rgba(var(--accent-rgb,249,115,22),0.15)]" : "border-border-t"
      }`}
    >
      {/* Away */}
      <div className="flex items-center gap-2">
        <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="h-7 w-7 object-contain shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className={`text-xs font-bold ${awayWon ? "text-text-primary" : "text-text-muted"}`}>
            {game.away_team}
          </span>
          {(isFinal || isLive) && (
            <span className={`text-lg font-extrabold tabular-nums leading-tight ${awayWon ? "text-text-primary" : "text-text-muted"}`}>
              {game.away_score}
            </span>
          )}
        </div>
      </div>

      {/* Status - fixed center */}
      <div className="flex flex-col items-center justify-center">
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            LIVE
          </span>
        ) : isFinal ? (
          <span className="text-[10px] font-semibold text-text-faint uppercase">Terminé</span>
        ) : (
          <span className="text-[10px] text-text-muted text-center">{game.status_text}</span>
        )}
      </div>

      {/* Home */}
      <div className="flex items-center gap-2 justify-end">
        <div className="flex flex-col items-end min-w-0">
          <span className={`text-xs font-bold ${homeWon ? "text-text-primary" : "text-text-muted"}`}>
            {game.home_team}
          </span>
          {(isFinal || isLive) && (
            <span className={`text-lg font-extrabold tabular-nums leading-tight ${homeWon ? "text-text-primary" : "text-text-muted"}`}>
              {game.home_score}
            </span>
          )}
        </div>
        <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="h-7 w-7 object-contain shrink-0" />
      </div>
    </Link>
  );
}

function MobileUpcoming({ game, isFav }: { game: Game; isFav: boolean }) {
  const time = game.game_time ? toParisTime(game.game_date, game.game_time) : "";

  return (
    <Link
      href={`/match/${game.game_id}`}
      className={`grid grid-cols-[1fr_auto_1fr] items-center rounded-xl bg-card border px-3 py-3 shrink-0 min-w-[220px] gap-3 transition-all duration-200 hover:border-border-hover hover:shadow-lg hover:-translate-y-0.5 ${
        isFav ? "border-accent/60 ring-2 ring-accent/20 shadow-[0_0_12px_rgba(var(--accent-rgb,249,115,22),0.15)]" : "border-border-t"
      }`}
    >
      <div className="flex items-center gap-2">
        <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="h-7 w-7 object-contain shrink-0" />
        <span className="text-xs font-bold text-text-primary">{game.away_team}</span>
      </div>
      <div className="flex flex-col items-center justify-center">
        {time ? (
          <span className="text-xs font-semibold text-accent">{time}</span>
        ) : (
          <span className="text-[10px] text-text-muted">{game.status_text}</span>
        )}
      </div>
      <div className="flex items-center gap-2 justify-end">
        <span className="text-xs font-bold text-text-primary">{game.home_team}</span>
        <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="h-7 w-7 object-contain shrink-0" />
      </div>
    </Link>
  );
}

function DesktopScore({ game, isFav }: { game: Game; isFav: boolean }) {
  const isFinal = game.status === 3;
  const isLive = game.status === 2;
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;

  return (
    <Link
      href={`/match/${game.game_id}`}
      className={`flex items-center gap-3 rounded-lg bg-card border px-3 py-2 shrink-0 min-w-[180px] transition-all duration-200 hover:border-border-hover hover:shadow-lg hover:-translate-y-0.5 ${
        isFav ? "border-accent/60 ring-2 ring-accent/20 shadow-[0_0_12px_rgba(var(--accent-rgb,249,115,22),0.15)]" : "border-border-t"
      }`}
    >
      <div className="flex flex-col items-center gap-0.5 w-10">
        <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="h-5 w-5 object-contain" />
        <span className={`text-[10px] font-bold ${awayWon ? "text-text-primary" : "text-text-muted"}`}>{game.away_team}</span>
      </div>
      <div className="flex flex-col items-center">
        {isFinal || isLive ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-bold tabular-nums ${awayWon ? "text-text-primary" : "text-text-muted"}`}>{game.away_score}</span>
              <span className="text-[10px] text-text-faint">-</span>
              <span className={`text-sm font-bold tabular-nums ${homeWon ? "text-text-primary" : "text-text-muted"}`}>{game.home_score}</span>
            </div>
            <span className={`text-[9px] font-medium mt-0.5 ${isLive ? "text-red-400" : "text-text-faint"}`}>
              {isLive ? "LIVE" : "Terminé"}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-text-muted">{game.status_text}</span>
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5 w-10">
        <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="h-5 w-5 object-contain" />
        <span className={`text-[10px] font-bold ${homeWon ? "text-text-primary" : "text-text-muted"}`}>{game.home_team}</span>
      </div>
    </Link>
  );
}

function DesktopUpcoming({ game, isFav }: { game: Game; isFav: boolean }) {
  const time = game.game_time ? toParisTime(game.game_date, game.game_time) : "";

  return (
    <Link
      href={`/match/${game.game_id}`}
      className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-card border px-3 py-2 shrink-0 min-w-[180px] transition-all duration-200 hover:border-border-hover hover:shadow-lg hover:-translate-y-0.5 ${
        isFav ? "border-accent/60 ring-2 ring-accent/20 shadow-[0_0_12px_rgba(var(--accent-rgb,249,115,22),0.15)]" : "border-border-t"
      }`}
    >
      <div className="flex flex-col items-center gap-0.5 justify-self-end">
        <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="h-5 w-5 object-contain" />
        <span className="text-[10px] font-bold text-text-primary">{game.away_team}</span>
      </div>
      <div className="flex flex-col items-center justify-center">
        {time ? (
          <span className="text-xs font-semibold text-accent">{time}</span>
        ) : (
          <span className="text-[10px] text-text-muted">{game.status_text}</span>
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5 justify-self-start">
        <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="h-5 w-5 object-contain" />
        <span className="text-[10px] font-bold text-text-primary">{game.home_team}</span>
      </div>
    </Link>
  );
}

export default function ScoresTicker({ games, mode = "results" }: { games: Game[]; mode?: "results" | "upcoming" }) {
  const [visible, setVisible] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isTeamFavorite } = useFavorites();
  const isUpcoming = mode === "upcoming";

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      const aFav = isTeamFavorite(a.home_team) || isTeamFavorite(a.away_team) ? 1 : 0;
      const bFav = isTeamFavorite(b.home_team) || isTeamFavorite(b.away_team) ? 1 : 0;
      return bFav - aFav;
    });
  }, [games, isTeamFavorite]);

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

  if (!visible) {
    return (
      <div className="mb-4">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 rounded-lg bg-card border border-border-t px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:border-border-hover transition-colors"
        >
          <Trophy size={12} />
          {isUpcoming ? "Matchs à venir" : "Scores de la nuit"}
          <ChevronRight size={12} />
        </button>
      </div>
    );
  }

  // Build header label
  let headerLabel: string;
  if (isUpcoming) {
    const dates = [...new Set(games.map(g => g.game_date))].sort();
    if (dates.length === 1) {
      headerLabel = new Date(dates[0] + "T12:00:00").toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } else {
      headerLabel = "Matchs à venir";
    }
  } else {
    const dateStr = games[0]?.game_date;
    headerLabel = dateStr
      ? new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : "Derniers scores";
  }

  const liveCount = games.filter(g => g.status === 2).length;
  const finalCount = games.filter(g => g.status === 3).length;
  const upcomingCount = isUpcoming ? games.length : games.length - finalCount - liveCount;

  return (
    <div className="mb-4 rounded-xl bg-card border border-border-t overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border-t/50">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy size={13} className="text-accent shrink-0" />
          <span className="text-xs font-semibold text-text-primary capitalize truncate">{headerLabel}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                <span className="h-1 w-1 rounded-full bg-red-400 animate-pulse" />
                {liveCount} LIVE
              </span>
            )}
            {finalCount > 0 && (
              <span className="text-[10px] text-text-faint">{finalCount} terminé{finalCount > 1 ? "s" : ""}</span>
            )}
            {upcomingCount > 0 && (
              <span className="text-[10px] text-text-faint hidden sm:inline">{upcomingCount} match{upcomingCount > 1 ? "s" : ""} à venir</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button type="button" aria-label="Défiler vers la gauche" onClick={() => scroll(-1)} className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-input transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button type="button" aria-label="Défiler vers la droite" onClick={() => scroll(1)} className="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-input transition-colors">
            <ChevronRight size={14} />
          </button>
          <button type="button" aria-label="Masquer les scores" onClick={toggle} className="rounded-md p-1 ml-0.5 text-text-faint hover:text-text-primary hover:bg-input transition-colors" title={isUpcoming ? "Masquer" : "Masquer les scores"}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Games */}
      <div
        ref={scrollRef}
        className="flex gap-2 px-3 sm:px-4 py-3 overflow-x-auto no-scrollbar touch-pan-x"
      >
        {sortedGames.map((game) => {
          const fav = isTeamFavorite(game.home_team) || isTeamFavorite(game.away_team);
          return (
            <span key={game.game_id} className="contents">
              {isUpcoming ? (
                <>
                  <span className="sm:hidden"><MobileUpcoming game={game} isFav={fav} /></span>
                  <span className="hidden sm:inline"><DesktopUpcoming game={game} isFav={fav} /></span>
                </>
              ) : (
                <>
                  <span className="sm:hidden"><MobileScore game={game} isFav={fav} /></span>
                  <span className="hidden sm:inline"><DesktopScore game={game} isFav={fav} /></span>
                </>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
