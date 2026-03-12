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

function GameCard({ game }: { game: Game }) {
  const isFinal = game.status === 3;
  const isLive = game.status === 2;
  const homeWon = isFinal && game.home_score > game.away_score;
  const awayWon = isFinal && game.away_score > game.home_score;

  return (
    <div className="rounded-xl bg-[#0c1222] border border-white/5 p-4 transition-all duration-200 hover:border-white/10">
      {/* Status */}
      <div className="flex items-center justify-between mb-3">
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            LIVE
          </span>
        ) : isFinal ? (
          <span className="text-xs font-medium text-gray-500">Final</span>
        ) : (
          <span className="text-xs font-medium text-gray-500">{game.status_text}</span>
        )}
        {game.arena && (
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <MapPin size={10} />
            {game.arena_city}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-2">
        <div className={`flex items-center justify-between ${awayWon ? "text-white" : isFinal ? "text-gray-500" : "text-gray-300"}`}>
          <div className="flex items-center gap-2">
            <span className="w-8 text-center text-sm font-bold">{game.away_team}</span>
            <span className="text-sm">{game.away_team_name}</span>
          </div>
          {(isFinal || isLive) && (
            <span className={`text-lg font-bold ${awayWon ? "text-orange-400" : ""}`}>
              {game.away_score}
            </span>
          )}
        </div>
        <div className={`flex items-center justify-between ${homeWon ? "text-white" : isFinal ? "text-gray-500" : "text-gray-300"}`}>
          <div className="flex items-center gap-2">
            <span className="w-8 text-center text-sm font-bold">{game.home_team}</span>
            <span className="text-sm">{game.home_team_name}</span>
          </div>
          {(isFinal || isLive) && (
            <span className={`text-lg font-bold ${homeWon ? "text-orange-400" : ""}`}>
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

  // Games grouped by date
  const gamesByDate = useMemo(() => {
    const map: Record<string, Game[]> = {};
    games.forEach((g) => {
      if (!map[g.game_date]) map[g.game_date] = [];
      map[g.game_date].push(g);
    });
    return map;
  }, [games]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday-based week (0=Mon, 6=Sun)
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
      <div className="rounded-2xl bg-[#111827] border border-white/5 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-white">
            {MONTHS_FR[month]} {year}
          </h2>
          <button onClick={nextMonth} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS_FR.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">
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
                    ? "bg-orange-500 text-white font-bold shadow-lg shadow-orange-500/20"
                    : isToday
                      ? "bg-orange-500/10 text-orange-400 font-semibold"
                      : gameCount > 0
                        ? "text-white hover:bg-white/5"
                        : "text-gray-600 hover:bg-white/5"
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
                          : "text-orange-500/60"
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
        <h3 className="text-sm font-semibold text-gray-400">
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          <span className="ml-2 text-gray-600">
            {selectedGames.length > 0
              ? `${selectedGames.length} match${selectedGames.length > 1 ? "s" : ""}`
              : "Aucun match"}
          </span>
        </h3>

        {selectedGames.length === 0 ? (
          <div className="rounded-2xl bg-[#111827] border border-white/5 p-8 text-center">
            <p className="text-sm text-gray-500">Pas de match ce jour</p>
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
