"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, MapPin, Star } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";
import { useFavorites } from "@/context/FavoritesContext";
import Link from "next/link";

interface Game {
  game_id: string;
  game_date: string;
  game_time: string;
  status: number;
  status_text: string;
  home_team: string;
  home_team_name: string;
  home_score: number;
  away_team: string;
  away_team_name: string;
  away_score: number;
  arena: string;
  arena_city: string;
}

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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

function GameCard({ game }: { game: Game }) {
  const isFinal = game.status === 3;
  const isLive = game.status === 2;
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;
  const { isTeamFavorite } = useFavorites();
  const isFav = isTeamFavorite(game.home_team) || isTeamFavorite(game.away_team);

  const canLink = isFinal || isLive;

  const card = (
    <div className={`rounded-xl bg-sidebar border p-3 transition-all duration-200 hover:border-border-hover ${canLink ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5" : ""} ${isFav ? "border-accent/60 ring-2 ring-accent/20 shadow-[0_0_12px_rgba(var(--accent-rgb,249,115,22),0.15)]" : "border-border-t"}`}>
      {/* Status */}
      <div className="flex items-center justify-between mb-2">
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            LIVE
          </span>
        ) : isFinal ? (
          <span className="text-xs font-medium text-text-muted">Terminé</span>
        ) : (
          <span className="text-xs font-medium text-text-muted">
            {toParisTime(game.game_date, game.game_time) || game.status_text}
          </span>
        )}
        {game.arena && (
          <span className="flex items-center gap-1 text-xs text-text-faint">
            <MapPin size={10} />
            {game.arena_city}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-1.5">
        <div className={`flex items-center justify-between ${awayWon ? "text-text-primary" : isFinal ? "text-text-muted" : "text-text-secondary"}`}>
          <div className="flex items-center gap-2">
            <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="h-5 w-5 shrink-0 object-contain" />
            <span className="text-xs font-bold">{game.away_team}</span>
            <span className="text-xs hidden sm:inline">{game.away_team_name}</span>
          </div>
          {(isFinal || isLive) && (
            <span className={`text-sm font-bold ${awayWon ? "text-accent-text" : ""}`}>
              {game.away_score}
            </span>
          )}
        </div>
        <div className={`flex items-center justify-between ${homeWon ? "text-text-primary" : isFinal ? "text-text-muted" : "text-text-secondary"}`}>
          <div className="flex items-center gap-2">
            <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="h-5 w-5 shrink-0 object-contain" />
            <span className="text-xs font-bold">{game.home_team}</span>
            <span className="text-xs hidden sm:inline">{game.home_team_name}</span>
          </div>
          {(isFinal || isLive) && (
            <span className={`text-sm font-bold ${homeWon ? "text-accent-text" : ""}`}>
              {game.home_score}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (canLink) {
    return <Link href={`/match/${game.game_id}`}>{card}</Link>;
  }
  return card;
}

export default function CalendarView({ games }: { games: Game[] }) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Find the best initial date for the current set of games
  const bestDate = useMemo(() => {
    if (games.length === 0) return todayStr;
    const dates = games.map((g) => g.game_date).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    // If today is within the season, use today
    if (todayStr >= firstDate && todayStr <= lastDate) return todayStr;
    // Otherwise use the last game (most relevant for past seasons)
    return lastDate;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games]);

  const bestD = new Date(bestDate + "T12:00:00");
  const [currentDate, setCurrentDate] = useState(new Date(bestD.getFullYear(), bestD.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string>(bestDate);

  // When games change (season switch), reposition the calendar
  useEffect(() => {
    const d = new Date(bestDate + "T12:00:00");
    setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDate(bestDate);
  }, [bestDate]);
  const gamesListRef = useRef<HTMLDivElement>(null);
  const { isTeamFavorite } = useFavorites();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const gamesByDate = useMemo(() => {
    const map: Record<string, Game[]> = {};
    games.forEach((g) => {
      if (!map[g.game_date]) map[g.game_date] = [];
      map[g.game_date].push(g);
    });
    return map;
  }, [games]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);

    return days;
  }, [year, month]);

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    gamesListRef.current?.scrollTo({ top: 0 });
  }

  function formatDateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const selectedGames = useMemo(() => {
    const list = gamesByDate[selectedDate] || [];
    return [...list].sort((a, b) => {
      const aFav = isTeamFavorite(a.home_team) || isTeamFavorite(a.away_team) ? 1 : 0;
      const bFav = isTeamFavorite(b.home_team) || isTeamFavorite(b.away_team) ? 1 : 0;
      return bFav - aFav;
    });
  }, [gamesByDate, selectedDate, isTeamFavorite]);
  const todayStr = today.toISOString().split("T")[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_350px] lg:h-[calc(100vh-12rem)]">
      {/* Calendar */}
      <div className="rounded-2xl bg-card border border-border-t p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="rounded-lg p-2 text-text-muted hover:bg-input hover:text-text-primary transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-text-primary">
            {MONTHS_FR[month]} {year}
          </h2>
          <button onClick={nextMonth} className="rounded-lg p-2 text-text-muted hover:bg-input hover:text-text-primary transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS_FR.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-text-muted py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {calendarDays.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} />;
            }

            const dateKey = formatDateKey(day);
            const dayGames = gamesByDate[dateKey];
            const gameCount = dayGames?.length || 0;
            const isToday = dateKey === todayStr;
            const isSelected = dateKey === selectedDate;
            const hasLive = dayGames?.some((g) => g.status === 2);
            const hasFav = dayGames?.some((g) => isTeamFavorite(g.home_team) || isTeamFavorite(g.away_team));

            return (
              <button
                key={dateKey}
                onClick={() => selectDate(dateKey)}
                className={`relative flex flex-col items-center justify-center rounded-lg text-sm transition-all duration-150 ${
                  isSelected
                    ? "bg-accent text-white font-bold shadow-lg"
                    : isToday
                      ? "bg-accent-light text-accent-text font-semibold"
                      : gameCount > 0
                        ? "text-text-primary hover:bg-input"
                        : "text-text-faint hover:bg-input"
                }`}
              >
                {day}
                {gameCount > 0 && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {hasFav && !isSelected && (
                      <Star size={8} className="fill-accent text-accent" />
                    )}
                    <span
                      className={`text-[9px] font-bold leading-none ${
                        isSelected
                          ? "text-white/80"
                          : hasLive
                            ? "text-red-400"
                            : hasFav
                              ? "text-accent"
                              : "text-accent/60"
                      }`}
                    >
                      {gameCount}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Games for selected date */}
      <div className="flex flex-col min-h-0 lg:max-h-none">
        <h3 className="text-sm font-semibold text-text-secondary mb-3 shrink-0">
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          <span className="ml-2 text-text-faint">
            {selectedGames.length > 0
              ? `${selectedGames.length} match${selectedGames.length > 1 ? "s" : ""}`
              : "Aucun match"}
          </span>
        </h3>

        <div ref={gamesListRef} className="flex-1 lg:overflow-y-auto space-y-2 min-h-0 lg:pr-1">
          {selectedGames.length === 0 ? (
            <div className="rounded-2xl bg-card border border-border-t p-8 text-center">
              <p className="text-sm text-text-muted">Pas de match ce jour</p>
            </div>
          ) : (
            selectedGames.map((game) => (
              <GameCard key={game.game_id} game={game} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
