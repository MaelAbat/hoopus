"use client";

import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, Star, Loader2 } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";
import { useFavorites } from "@/context/FavoritesContext";
import { createClient } from "@/lib/supabase/client";
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
  "Janvier", "F\u00E9vrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Ao\u00FBt", "Septembre", "Octobre", "Novembre", "D\u00E9cembre",
];

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Derive the NBA season for a given month/year (Oct+ = new season). */
function seasonForMonth(year: number, month: number): string {
  const startYear = month >= 9 ? year : year - 1; // month is 0-indexed, 9 = October
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${endYear.toString().padStart(2, "0")}`;
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

function getGameLabel(gameId: string): string | null {
  if (gameId.startsWith("005")) return "Play-in";
  if (gameId.startsWith("004")) {
    const round = gameId.substring(6, 8);
    if (round === "01") return "1er tour";
    if (round === "02") return "Demi-finale de conf\u00E9rence";
    if (round === "03") return "Finale de conf\u00E9rence";
    if (round === "04") return "Finales NBA";
    return "Playoffs";
  }
  return null;
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
      {/* Playoff label */}
      {getGameLabel(game.game_id) && (
        <div className="mb-1.5">
          <span className="inline-block rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-text">
            {getGameLabel(game.game_id)}
          </span>
        </div>
      )}

      {/* Status */}
      <div className="flex items-center justify-between mb-2">
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            LIVE
          </span>
        ) : isFinal ? (
          <span className="text-xs font-medium text-text-muted">Termin\u00E9</span>
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
            {game.away_team === "TBD" ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-input text-[8px] font-bold text-text-faint">?</span>
            ) : (
              <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="h-5 w-5 shrink-0 object-contain" />
            )}
            <span className={`text-xs font-bold ${game.away_team === "TBD" ? "text-text-faint italic" : ""}`}>{game.away_team === "TBD" ? "\u00C0 d\u00E9terminer" : game.away_team}</span>
            {game.away_team !== "TBD" && <span className="text-xs hidden sm:inline">{game.away_team_name}</span>}
          </div>
          {(isFinal || isLive) && (
            <span className={`text-sm font-bold ${awayWon ? "text-accent-text" : ""}`}>
              {game.away_score}
            </span>
          )}
        </div>
        <div className={`flex items-center justify-between ${homeWon ? "text-text-primary" : isFinal ? "text-text-muted" : "text-text-secondary"}`}>
          <div className="flex items-center gap-2">
            {game.home_team === "TBD" ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-input text-[8px] font-bold text-text-faint">?</span>
            ) : (
              <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="h-5 w-5 shrink-0 object-contain" />
            )}
            <span className={`text-xs font-bold ${game.home_team === "TBD" ? "text-text-faint italic" : ""}`}>{game.home_team === "TBD" ? "\u00C0 d\u00E9terminer" : game.home_team}</span>
            {game.home_team !== "TBD" && <span className="text-xs hidden sm:inline">{game.home_team_name}</span>}
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

export default function CalendarView({ games: initialGames, initialSeason }: { games: Game[]; initialSeason?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // All loaded games merged from all fetched seasons
  const [allGames, setAllGames] = useState<Game[]>(initialGames);
  const [loadedSeasons, setLoadedSeasons] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (initialSeason) s.add(initialSeason);
    return s;
  });
  const [loading, setLoading] = useState(false);

  // Sync when initialGames/initialSeason change (season dropdown switch)
  useEffect(() => {
    setAllGames(initialGames);
    const s = new Set<string>();
    if (initialSeason) s.add(initialSeason);
    setLoadedSeasons(s);
  }, [initialGames, initialSeason]);

  // Find the best initial date for the current set of games
  const bestDate = useMemo(() => {
    if (initialGames.length === 0) return todayStr;
    const dates = initialGames.map((g) => g.game_date).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    if (todayStr >= firstDate && todayStr <= lastDate) return todayStr;
    return lastDate;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGames]);

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

  // Fetch games for a season dynamically
  const fetchSeason = useCallback(async (season: string) => {
    if (loadedSeasons.has(season)) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: p1 }, { data: p2 }] = await Promise.all([
        supabase.from("games").select("*").eq("season", season).order("game_date", { ascending: true }).range(0, 999),
        supabase.from("games").select("*").eq("season", season).order("game_date", { ascending: true }).range(1000, 1999),
      ]);
      const newGames = [...(p1 || []), ...(p2 || [])] as Game[];
      setAllGames((prev) => [...prev, ...newGames]);
      setLoadedSeasons((prev) => new Set(prev).add(season));
    } finally {
      setLoading(false);
    }
  }, [loadedSeasons]);

  // When month changes, check if we need to fetch a new season + sync URL
  useEffect(() => {
    const neededSeason = seasonForMonth(year, month);
    if (!loadedSeasons.has(neededSeason)) {
      fetchSeason(neededSeason);
    }
    // Sync the season dropdown via URL
    const currentUrlSeason = searchParams.get("season") || initialSeason;
    if (neededSeason !== currentUrlSeason) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("season", neededSeason);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const gamesByDate = useMemo(() => {
    const map: Record<string, Game[]> = {};
    allGames.forEach((g) => {
      if (!map[g.game_date]) map[g.game_date] = [];
      map[g.game_date].push(g);
    });
    return map;
  }, [allGames]);

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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_350px] lg:h-[calc(100vh-12rem)]">
      {/* Calendar */}
      <div className="rounded-2xl bg-card border border-border-t p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="rounded-lg p-2 text-text-muted hover:bg-input hover:text-text-primary transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            {MONTHS_FR[month]} {year}
            {loading && <Loader2 size={14} className="animate-spin text-text-faint" />}
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
