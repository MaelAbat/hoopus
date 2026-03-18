"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

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

const TEAM_ID: Record<string, number> = {
  ATL: 1610612737, BOS: 1610612738, BKN: 1610612751, CHA: 1610612766,
  CHI: 1610612741, CLE: 1610612739, DAL: 1610612742, DEN: 1610612743,
  DET: 1610612765, GSW: 1610612744, HOU: 1610612745, IND: 1610612754,
  LAC: 1610612746, LAL: 1610612747, MEM: 1610612763, MIA: 1610612748,
  MIL: 1610612749, MIN: 1610612750, NOP: 1610612740, NYK: 1610612752,
  OKC: 1610612760, ORL: 1610612753, PHI: 1610612755, PHX: 1610612756,
  POR: 1610612757, SAC: 1610612758, SAS: 1610612759, TOR: 1610612761,
  UTA: 1610612762, WAS: 1610612764,
};

function teamLogoUrl(tricode: string): string {
  const id = TEAM_ID[tricode];
  return id ? `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg` : "";
}

function GameCard({ game }: { game: Game }) {
  const isFinal = game.status === 3;
  const isLive = game.status === 2;
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;

  return (
    <div className="rounded-xl bg-sidebar border border-border-t p-4 transition-all duration-200 hover:border-border-hover">
      {/* Status */}
      <div className="flex items-center justify-between mb-3">
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            LIVE
          </span>
        ) : isFinal ? (
          <span className="text-xs font-medium text-text-muted">Final</span>
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
      <div className="space-y-2">
        <div className={`flex items-center justify-between ${awayWon ? "text-text-primary" : isFinal ? "text-text-muted" : "text-text-secondary"}`}>
          <div className="flex items-center gap-2">
            <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="h-6 w-6 shrink-0 object-contain" />
            <span className="w-8 text-center text-sm font-bold">{game.away_team}</span>
            <span className="text-sm">{game.away_team_name}</span>
          </div>
          {(isFinal || isLive) && (
            <span className={`text-lg font-bold ${awayWon ? "text-accent-text" : ""}`}>
              {game.away_score}
            </span>
          )}
        </div>
        <div className={`flex items-center justify-between ${homeWon ? "text-text-primary" : isFinal ? "text-text-muted" : "text-text-secondary"}`}>
          <div className="flex items-center gap-2">
            <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="h-6 w-6 shrink-0 object-contain" />
            <span className="w-8 text-center text-sm font-bold">{game.home_team}</span>
            <span className="text-sm">{game.home_team_name}</span>
          </div>
          {(isFinal || isLive) && (
            <span className={`text-lg font-bold ${homeWon ? "text-accent-text" : ""}`}>
              {game.home_score}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CalendarView({ games }: { games: Game[] }) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().split("T")[0]
  );

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

  function formatDateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const selectedGames = gamesByDate[selectedDate] || [];
  const todayStr = today.toISOString().split("T")[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      {/* Calendar */}
      <div className="rounded-2xl bg-card border border-border-t p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS_FR.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-text-muted py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }

            const dateKey = formatDateKey(day);
            const dayGames = gamesByDate[dateKey];
            const gameCount = dayGames?.length || 0;
            const isToday = dateKey === todayStr;
            const isSelected = dateKey === selectedDate;
            const hasLive = dayGames?.some((g) => g.status === 2);

            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDate(dateKey)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all duration-150 ${
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
                  <span
                    className={`absolute bottom-1 text-[9px] font-bold ${
                      isSelected
                        ? "text-white/80"
                        : hasLive
                          ? "text-red-400"
                          : "text-accent/60"
                    }`}
                  >
                    {gameCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Games for selected date */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-secondary">
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
  );
}
