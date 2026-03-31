"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ArrowUp, ArrowDown, Check, RotateCcw, Trophy, Search, Clock, LogIn } from "lucide-react";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export interface HooplPlayer {
  id: number;
  name: string;
  team: string;
  teamName: string;
  conference: string;
  division: string;
  position: string;
  age: number;
  height: string;
  country: string;
  jersey: string;
  draft: string;
  pts: number;
  reb: number;
  ast: number;
}

type ClueStatus = "correct" | "higher" | "lower" | "wrong";

interface GuessResult {
  player: HooplPlayer;
  clues: {
    team: ClueStatus;
    conference: ClueStatus;
    division: ClueStatus;
    position: ClueStatus;
    age: ClueStatus;
    height: ClueStatus;
    pts: ClueStatus;
    reb: ClueStatus;
    ast: ClueStatus;
  };
}

const COLUMNS = [
  { key: "team", label: "Équipe" },
  { key: "conference", label: "Conf." },
  { key: "division", label: "Div." },
  { key: "position", label: "Pos" },
  { key: "age", label: "Age" },
  { key: "height", label: "Taille" },
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
] as const;

function heightToInches(h: string): number {
  const match = h.match(/(\d+)-(\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) * 12 + parseInt(match[2]);
}

function getDailyPlayerIndex(playerCount: number): number {
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  // Simple hash
  let hash = seed;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = (hash >> 16) ^ hash;
  return Math.abs(hash) % playerCount;
}

function getStorageKey(): string {
  const now = new Date();
  return `hoopl-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function compareNumeric(guess: number, target: number): ClueStatus {
  if (guess === target) return "correct";
  return guess > target ? "lower" : "higher";
}

function compareExact(guess: string, target: string): ClueStatus {
  return guess === target ? "correct" : "wrong";
}

function comparePosition(guess: string, target: string): ClueStatus {
  if (guess === target) return "correct";
  // Partial match: both contain G, both contain F, etc.
  const gParts = guess.split("-");
  const tParts = target.split("-");
  if (gParts.some((p) => tParts.includes(p))) return "higher"; // partial = orange
  return "wrong";
}

function clueClass(status: ClueStatus): string {
  switch (status) {
    case "correct":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "higher":
      return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    case "lower":
      return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    case "wrong":
      return "bg-red-500/15 text-red-400 border-red-500/30";
  }
}

function ClueIcon({ status }: { status: ClueStatus }) {
  if (status === "correct") return <Check size={14} className="text-emerald-400" />;
  if (status === "higher") return <ArrowUp size={14} />;
  if (status === "lower") return <ArrowDown size={14} />;
  return null;
}

interface LeaderboardEntry {
  display_name: string;
  guesses: number;
  time_seconds: number;
  won: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export default function HooplGame({ players }: { players: HooplPlayer[] }) {
  const [guessIds, setGuessIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [won, setWon] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const target = useMemo(() => {
    if (players.length === 0) return null;
    const idx = getDailyPlayerIndex(players.length);
    return players[idx];
  }, [players]);

  const gameDate = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }, []);

  // Check auth state + listen for login
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load saved state from localStorage
  useEffect(() => {
    if (!target) return;
    const key = getStorageKey();
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        setGuessIds(data.guesses || []);
        setWon(data.won || false);
        setElapsed(data.elapsed || 0);
        setSubmitted(data.submitted || false);
        setStartTime(data.startTime || Date.now());
      } else {
        setStartTime(Date.now());
      }
    } catch {
      setStartTime(Date.now());
    }
    setLoaded(true);
  }, [target]);

  // Save state to localStorage (only after initial load)
  useEffect(() => {
    if (!target || !loaded) return;
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify({ guesses: guessIds, won, elapsed, submitted, startTime }));
  }, [guessIds, won, target, loaded, elapsed, submitted, startTime]);

  // Timer tick
  useEffect(() => {
    if (!loaded || won || (guessIds.length >= 10) || !startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [loaded, won, guessIds.length, startTime]);

  // Submit score when user logs in after finishing the game
  useEffect(() => {
    if (!userId || submitted || !loaded) return;
    const gameOver = won || guessIds.length >= 10;
    if (!gameOver) return;
    submitScore(guessIds.length, won);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loaded]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("hoopl_scores")
      .select("display_name, guesses, time_seconds, won")
      .eq("game_date", gameDate)
      .eq("won", true)
      .order("guesses", { ascending: true })
      .order("time_seconds", { ascending: true })
      .limit(15);
    setLeaderboard(data || []);
  }, [gameDate]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Submit score
  const submitScore = useCallback(async (guessCount: number, didWin: boolean) => {
    if (submitted || !userId) return;
    const supabase = createClient();
    const finalTime = Math.floor((Date.now() - startTime) / 1000);
    setElapsed(finalTime);

    // Get display name from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();

    const displayName = profile?.display_name || "Anonyme";

    await supabase.from("hoopl_scores").upsert({
      user_id: userId,
      display_name: displayName,
      game_date: gameDate,
      guesses: guessCount,
      time_seconds: finalTime,
      won: didWin,
    }, { onConflict: "user_id,game_date" });

    setSubmitted(true);
    fetchLeaderboard();
  }, [submitted, userId, startTime, gameDate, fetchLeaderboard]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const guessResults: GuessResult[] = useMemo(() => {
    if (!target) return [];
    return guessIds.map((id) => {
      const player = players.find((p) => p.id === id);
      if (!player) return null;

      const targetInches = heightToInches(target.height);
      const guessInches = heightToInches(player.height);

      return {
        player,
        clues: {
          team: compareExact(player.team, target.team),
          conference: compareExact(player.conference, target.conference),
          division: compareExact(player.division, target.division),
          position: comparePosition(player.position, target.position),
          age: compareNumeric(player.age, target.age),
          height: compareNumeric(guessInches, targetInches),
          pts: compareNumeric(Math.round(player.pts * 10), Math.round(target.pts * 10)),
          reb: compareNumeric(Math.round(player.reb * 10), Math.round(target.reb * 10)),
          ast: compareNumeric(Math.round(player.ast * 10), Math.round(target.ast * 10)),
        },
      };
    }).filter(Boolean) as GuessResult[];
  }, [guessIds, players, target]);

  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return [];
    const q = normalize(search);
    return players
      .filter((p) => normalize(p.name).includes(q) && !guessIds.includes(p.id))
      .slice(0, 8);
  }, [search, players, guessIds]);

  const MAX_GUESSES = 10;
  const lost = !won && guessIds.length >= MAX_GUESSES;

  function handleGuess(player: HooplPlayer) {
    if (won || lost || !target || guessIds.includes(player.id)) return;
    const newGuesses = [...guessIds, player.id];
    setGuessIds(newGuesses);
    setSearch("");
    setShowDropdown(false);
    if (player.id === target.id) {
      setWon(true);
      submitScore(newGuesses.length, true);
    } else if (newGuesses.length >= MAX_GUESSES) {
      submitScore(newGuesses.length, false);
    }
  }

  function handleReset() {
    const key = getStorageKey();
    localStorage.removeItem(key);
    setGuessIds([]);
    setWon(false);
    setSearch("");
  }

  function renderClueValue(result: GuessResult, key: string): string {
    const p = result.player;
    switch (key) {
      case "team": return p.team;
      case "conference": return p.conference;
      case "division": return p.division;
      case "position": return p.position;
      case "age": return String(p.age);
      case "height": return p.height;
      case "pts": return p.pts.toFixed(1);
      case "reb": return p.reb.toFixed(1);
      case "ast": return p.ast.toFixed(1);
      default: return "";
    }
  }

  if (!target) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-text-muted">
        Aucun joueur disponible. Synchronisez les données.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      {/* Header */}
      <div className="pt-4 space-y-4">
        <Link
          href="/mini-jeux"
          className="inline-flex items-center gap-1.5 rounded-lg bg-input px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
        >
          <RotateCcw size={12} />
          Tous les mini-jeux
        </Link>

        {/* Game banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border-t bg-gradient-to-br from-accent/10 via-card to-card">
          <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 opacity-[0.07]">
            <svg viewBox="0 0 100 100" className="w-full h-full text-accent">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" />
              <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" strokeWidth="2" />
              <line x1="5" y1="50" x2="95" y2="50" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>

          <div className="relative px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Mystery silhouette */}
              <div className="relative shrink-0">
                <div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 border-2 border-accent/40 flex items-center justify-center ${won ? "" : "animate-pulse"}`}>
                  {won || lost ? (
                    <img src={playerPhotoUrl(target.id)} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-2xl sm:text-3xl font-black text-accent/60">?</span>
                  )}
                </div>
                {won && (
                  <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
                  Hoop<span className="text-accent">l</span>
                </h1>
                <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                  {won ? `Trouvé en ${guessIds.length} essai${guessIds.length > 1 ? "s" : ""} !`
                    : lost ? "Partie terminée"
                    : "Devine le joueur NBA du jour"}
                </p>

                {/* Progress bar */}
                {!won && !lost && loaded && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-text-faint">{guessIds.length}/{MAX_GUESSES} essais</span>
                      <span className="flex items-center gap-1 text-text-faint">
                        <Clock size={10} />
                        {formatTime(elapsed)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-input overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover transition-all duration-500"
                        style={{ width: `${(guessIds.length / MAX_GUESSES) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Win stats */}
                {won && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                      <Trophy size={11} /> {guessIds.length} essai{guessIds.length > 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent-text">
                      <Clock size={11} /> {formatTime(elapsed)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {!userId && (
          <div className="rounded-xl bg-input/50 border border-border-t px-4 py-2.5 text-center text-xs text-text-muted">
            <LogIn size={12} className="inline mr-1.5 -mt-0.5" />
            <Link href="/auth/login" className="text-accent-text hover:underline">Connecte-toi</Link> pour enregistrer ton score au classement
          </div>
        )}
      </div>

      {/* Hint after 5 guesses */}
      {!won && !lost && guessIds.length >= 5 && (
        <div className="rounded-xl bg-accent/10 border border-accent/30 px-4 py-3 text-center text-sm animate-[fadeIn_0.5s_ease-out]">
          <span className="text-text-muted">Indice : il joue pour les </span>
          <span className="font-bold text-accent-text">{target.teamName}</span>
          <img src={teamLogoUrl(target.team)} alt="" className="inline h-5 w-5 ml-1.5 -mt-0.5 object-contain" />
        </div>
      )}

      {/* Search input */}
      {!won && !lost && (
        <div className="relative">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Tape le nom d'un joueur..."
              className="w-full rounded-xl bg-card border border-border-t pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Dropdown */}
          {showDropdown && filteredPlayers.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 mt-1 w-full rounded-xl bg-card border border-border-t shadow-xl overflow-hidden"
            >
              {filteredPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleGuess(p)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-card-hover transition-colors"
                >
                  <img
                    src={playerPhotoUrl(p.id)}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover bg-input"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text-primary">{p.name}</span>
                  </div>
                  <img src={teamLogoUrl(p.team)} alt={p.team} className="h-5 w-5 object-contain" />
                  <span className="text-xs text-text-faint">{p.team}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Win reveal */}
      {won && (
        <div className="rounded-2xl overflow-hidden border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-card p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={playerPhotoUrl(target.id)} alt="" className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover bg-input shadow-lg" />
              <img src={teamLogoUrl(target.team)} alt="" className="absolute -bottom-1 -right-1 h-7 w-7 object-contain bg-card rounded-full p-0.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Bravo !</p>
              <p className="text-xl sm:text-2xl font-extrabold text-text-primary mt-0.5">{target.name}</p>
              <p className="text-sm text-text-muted">{target.teamName} -- {target.position}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-text-faint">
                <span className="font-bold text-text-secondary">{target.pts.toFixed(1)} <span className="font-normal">PTS</span></span>
                <span className="font-bold text-text-secondary">{target.reb.toFixed(1)} <span className="font-normal">REB</span></span>
                <span className="font-bold text-text-secondary">{target.ast.toFixed(1)} <span className="font-normal">AST</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lost reveal */}
      {lost && (
        <div className="rounded-2xl overflow-hidden border border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-500/5 to-card p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={playerPhotoUrl(target.id)} alt="" className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover bg-input shadow-lg" />
              <img src={teamLogoUrl(target.team)} alt="" className="absolute -bottom-1 -right-1 h-7 w-7 object-contain bg-card rounded-full p-0.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Perdu !</p>
              <p className="text-xl sm:text-2xl font-extrabold text-text-primary mt-0.5">{target.name}</p>
              <p className="text-sm text-text-muted">{target.teamName} -- {target.position}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-text-faint">
                <span className="font-bold text-text-secondary">{target.pts.toFixed(1)} <span className="font-normal">PTS</span></span>
                <span className="font-bold text-text-secondary">{target.reb.toFixed(1)} <span className="font-normal">REB</span></span>
                <span className="font-bold text-text-secondary">{target.ast.toFixed(1)} <span className="font-normal">AST</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results — cards on mobile, table on desktop */}
      {guessResults.length > 0 && (
        <>
          {/* Mobile: card layout */}
          <div className="space-y-3 sm:hidden">
            {guessResults.map((result) => (
              <div key={result.player.id} className="rounded-xl bg-card border border-border-t p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <img
                    src={playerPhotoUrl(result.player.id)}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover bg-input"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-sm font-bold text-text-primary">{result.player.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {COLUMNS.map((col) => {
                    const status = result.clues[col.key as keyof typeof result.clues];
                    return (
                      <div
                        key={col.key}
                        className={`flex flex-col items-center rounded-lg border px-1.5 py-1.5 ${clueClass(status)}`}
                      >
                        <span className="text-[9px] font-medium opacity-70">{col.label}</span>
                        <div className="flex items-center gap-0.5 text-xs font-bold">
                          {col.key === "team" ? (
                            <img src={teamLogoUrl(result.player.team)} alt="" className="h-3.5 w-3.5 object-contain" />
                          ) : (
                            <ClueIcon status={status} />
                          )}
                          <span>{renderClueValue(result, col.key)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block rounded-2xl bg-card border border-border-t overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-t text-text-faint">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium">Joueur</th>
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="px-2 py-2 text-center text-xs font-medium whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guessResults.map((result, i) => (
                    <tr key={result.player.id} className="border-b border-border-t/30">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={playerPhotoUrl(result.player.id)}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover bg-input"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <span className="text-xs font-medium text-text-primary whitespace-nowrap">{result.player.name}</span>
                        </div>
                      </td>
                      {COLUMNS.map((col) => {
                        const status = result.clues[col.key as keyof typeof result.clues];
                        return (
                          <td key={col.key} className="px-1.5 py-2">
                            <div
                              className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium whitespace-nowrap ${clueClass(status)}`}
                            >
                              {col.key === "team" ? (
                                <img src={teamLogoUrl(result.player.team)} alt="" className="h-4 w-4 object-contain" />
                              ) : (
                                <ClueIcon status={status} />
                              )}
                              <span>{renderClueValue(result, col.key)}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
          <div className="px-4 py-3 border-b border-border-t">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Trophy size={16} className="text-accent-text" />
              Classement du jour
            </h2>
          </div>
          <div className="divide-y divide-border-t/30">
            {leaderboard.map((entry, i) => (
              <div key={`${entry.display_name}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                  i === 0 ? "bg-accent/20 text-accent-text"
                  : i <= 2 ? "bg-input text-text-primary"
                  : "text-text-faint"
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-text-primary truncate">{entry.display_name}</span>
                <span className="text-xs text-text-muted tabular-nums">{entry.guesses} essai{entry.guesses > 1 ? "s" : ""}</span>
                <span className="text-xs text-text-faint tabular-nums w-12 text-right">{formatTime(entry.time_seconds)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-text-faint pb-4">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-emerald-500/30" />
          Correct
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-orange-500/30" />
          <ArrowUp size={10} /> Plus haut / <ArrowDown size={10} /> Plus bas
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-red-500/30" />
          Incorrect
        </div>
      </div>
    </div>
  );
}
