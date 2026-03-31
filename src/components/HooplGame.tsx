"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowUp, ArrowDown, Check, RotateCcw, Trophy, Search } from "lucide-react";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";
import Link from "next/link";

export interface HooplPlayer {
  id: number;
  name: string;
  team: string;
  teamName: string;
  conference: string;
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
    position: ClueStatus;
    age: ClueStatus;
    height: ClueStatus;
    pts: ClueStatus;
    reb: ClueStatus;
    ast: ClueStatus;
  };
}

const COLUMNS = [
  { key: "team", label: "Equipe" },
  { key: "conference", label: "Conf." },
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

export default function HooplGame({ players }: { players: HooplPlayer[] }) {
  const [guessIds, setGuessIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [won, setWon] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const target = useMemo(() => {
    if (players.length === 0) return null;
    const idx = getDailyPlayerIndex(players.length);
    return players[idx];
  }, [players]);

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
      }
    } catch { /* ignore */ }
  }, [target]);

  // Save state to localStorage
  useEffect(() => {
    if (!target) return;
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify({ guesses: guessIds, won, lost: !won && guessIds.length >= MAX_GUESSES }));
  }, [guessIds, won, target]);

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

  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return players
      .filter((p) => p.name.toLowerCase().includes(q) && !guessIds.includes(p.id))
      .slice(0, 8);
  }, [search, players, guessIds]);

  const MAX_GUESSES = 5;
  const lost = !won && guessIds.length >= MAX_GUESSES;

  function handleGuess(player: HooplPlayer) {
    if (won || lost || !target || guessIds.includes(player.id)) return;
    const newGuesses = [...guessIds, player.id];
    setGuessIds(newGuesses);
    setSearch("");
    setShowDropdown(false);
    if (player.id === target.id) {
      setWon(true);
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
        Aucun joueur disponible. Synchronisez les donnees.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0">
      {/* Header */}
      <div className="text-center space-y-2 pt-4">
        <Link href="/mini-jeux" className="text-xs text-text-faint hover:text-text-muted transition-colors">
          Mini-jeux
        </Link>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Hoopl</h1>
        <p className="text-sm text-text-muted">Devine le joueur NBA du jour</p>
      </div>

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

      {/* Win state */}
      {won && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-6 text-center space-y-3">
          <Trophy size={32} className="text-emerald-400 mx-auto" />
          <div>
            <p className="text-lg font-bold text-emerald-400">Bravo !</p>
            <p className="text-sm text-text-muted">
              Tu as trouve <strong className="text-text-primary">{target.name}</strong> en {guessIds.length} essai{guessIds.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <img src={playerPhotoUrl(target.id)} alt="" className="h-16 w-16 rounded-full object-cover bg-input" />
            <div className="text-left">
              <p className="font-bold text-text-primary">{target.name}</p>
              <p className="text-xs text-text-muted">{target.teamName} - {target.position}</p>
              <p className="text-xs text-text-faint">{target.pts.toFixed(1)} PTS / {target.reb.toFixed(1)} REB / {target.ast.toFixed(1)} AST</p>
            </div>
          </div>
        </div>
      )}

      {/* Lost state */}
      {lost && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-6 text-center space-y-3">
          <p className="text-lg font-bold text-red-400">Perdu !</p>
          <p className="text-sm text-text-muted">
            Le joueur etait <strong className="text-text-primary">{target.name}</strong>
          </p>
          <div className="flex items-center justify-center gap-3">
            <img src={playerPhotoUrl(target.id)} alt="" className="h-16 w-16 rounded-full object-cover bg-input" />
            <div className="text-left">
              <p className="font-bold text-text-primary">{target.name}</p>
              <p className="text-xs text-text-muted">{target.teamName} - {target.position}</p>
              <p className="text-xs text-text-faint">{target.pts.toFixed(1)} PTS / {target.reb.toFixed(1)} REB / {target.ast.toFixed(1)} AST</p>
            </div>
          </div>
        </div>
      )}

      {/* Guess count */}
      {guessIds.length > 0 && !won && !lost && (
        <p className="text-center text-xs text-text-faint">
          {guessIds.length}/{MAX_GUESSES} essai{guessIds.length > 1 ? "s" : ""}
        </p>
      )}

      {/* Results grid */}
      {guessResults.length > 0 && (
        <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
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
                            style={{ animationDelay: `${i * 50}ms` }}
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
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-text-faint">
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
