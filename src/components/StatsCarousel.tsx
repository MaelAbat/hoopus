"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Trophy, List, Filter } from "lucide-react";
import type { PlayerStatLeader } from "@/lib/nba-api";

interface Board {
  title: string;
  stat: string;
  unit: string;
  top10: PlayerStatLeader[];
  full: PlayerStatLeader[];
  eligibleCount?: number;
}

type ViewMode = "top10" | "full";
type EligibilityFilter = "eligible" | "all";

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

const PAGE_SIZE = 50;

function teamLogoUrl(tricode: string): string {
  const id = TEAM_ID[tricode];
  return id ? `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg` : "";
}

function PlayerRow({ player, displayRank }: { player: PlayerStatLeader; displayRank?: number }) {
  const rank = displayRank ?? player.rank;
  return (
    <div className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-card-hover">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
          rank === 1
            ? "bg-accent/20 text-accent-text"
            : rank <= 3
              ? "bg-input text-text-primary"
              : "bg-input text-text-muted"
        }`}
      >
        {rank}
      </span>
      <img
        src={teamLogoUrl(player.team)}
        alt={player.team}
        className="h-7 w-7 shrink-0 object-contain"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text-primary truncate">{player.name}</p>
        <p className="text-xs text-text-muted">{player.team}</p>
      </div>
      <span className="text-xl font-bold text-text-primary tabular-nums">
        {player.value}
      </span>
    </div>
  );
}

export default function StatsCarousel({ boards }: { boards: Board[] }) {
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<ViewMode>("top10");
  const [eligibility, setEligibility] = useState<EligibilityFilter>("eligible");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  const board = boards[active];
  const hasEligibility = board.eligibleCount != null;

  // Build the player list for full mode based on eligibility filter
  const fullPlayers = useMemo(() => {
    if (!hasEligibility || eligibility === "eligible") {
      // For eligible-only or categories without eligibility: use rank as-is
      // eligible players have rank 1..eligibleCount
      if (hasEligibility) {
        return board.full.filter((p) => p.rank <= board.eligibleCount!);
      }
      return board.full;
    }
    // "All" mode: re-sort all players by value descending and re-rank
    return [...board.full]
      .sort((a, b) => Number(b.value) - Number(a.value))
      .map((p, i) => ({ ...p, rank: i + 1 }));
  }, [board.full, board.eligibleCount, hasEligibility, eligibility]);

  const filteredFull = useMemo(() => {
    if (!search.trim()) return fullPlayers;
    const q = search.toLowerCase();
    return fullPlayers.filter(
      (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
    );
  }, [fullPlayers, search]);

  const totalPages = Math.ceil(filteredFull.length / PAGE_SIZE);
  const pagedPlayers = filteredFull.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // For top10, use eligible-only data (first 10 by rank)
  const top10Players = useMemo(() => {
    if (hasEligibility) {
      return board.full.filter((p) => p.rank <= 10);
    }
    return board.top10;
  }, [board.full, board.top10, hasEligibility]);

  const displayPlayers = mode === "top10" ? top10Players : pagedPlayers;

  function go(dir: -1 | 1) {
    setActive((prev) => (prev + dir + boards.length) % boards.length);
  }

  // Reset page and search when changing category, mode, or eligibility
  useEffect(() => {
    setPage(0);
    setSearch("");
  }, [active, mode, eligibility]);

  // Reset eligibility when changing category
  useEffect(() => {
    setEligibility("eligible");
  }, [active]);

  // Center active tab
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });

    const track = trackRef.current;
    if (!track) return;

    const buttons = track.querySelectorAll<HTMLButtonElement>("button");
    const btn = buttons[active];
    if (!btn) return;

    const trackWidth = track.parentElement?.offsetWidth ?? 0;
    const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
    setOffset(trackWidth / 2 - btnCenter);
  }, [active]);

  // Reset page when search changes
  useEffect(() => {
    setPage(0);
  }, [search]);

  return (
    <div className="flex items-center gap-4 h-[calc(100vh-14rem)]">
      {/* Left arrow */}
      <button
        onClick={() => go(-1)}
        className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border-t text-text-muted hover:bg-input hover:text-text-primary transition-colors"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="rounded-2xl bg-card border border-border-t overflow-hidden flex flex-col flex-1 h-full">
        {/* Category tabs */}
        <div className="border-b border-border-t py-3 overflow-hidden">
          <div
            ref={trackRef}
            className="flex gap-1.5 transition-transform duration-300 ease-out w-max"
            style={{ transform: `translateX(${offset}px)` }}
          >
            {boards.map((b, i) => (
              <button
                key={b.stat}
                onClick={() => setActive(i)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 shrink-0 ${
                  active === i
                    ? "bg-accent text-white shadow-md"
                    : "bg-input text-text-muted hover:bg-card-hover hover:text-text-primary"
                }`}
              >
                {b.title}
              </button>
            ))}
          </div>
        </div>

        {/* View mode toggle + eligibility filter */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border-t/50">
          <div className="flex rounded-lg bg-input p-0.5">
            <button
              onClick={() => setMode("top10")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                mode === "top10"
                  ? "bg-card text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <Trophy size={13} />
              Top 10
            </button>
            <button
              onClick={() => setMode("full")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                mode === "full"
                  ? "bg-card text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <List size={13} />
              Classement complet
              <span className="text-text-faint">({fullPlayers.length})</span>
            </button>
          </div>

          {/* Eligibility filter (only for percentage categories in full mode) */}
          {mode === "full" && hasEligibility && (
            <div className="flex rounded-lg bg-input p-0.5">
              <button
                onClick={() => setEligibility("eligible")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  eligibility === "eligible"
                    ? "bg-card text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <Filter size={12} />
                Éligibles
              </button>
              <button
                onClick={() => setEligibility("all")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  eligibility === "all"
                    ? "bg-card text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                Tous
                <span className="text-text-faint">({board.full.length})</span>
              </button>
            </div>
          )}

          {/* Search (full mode only) */}
          {mode === "full" && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un joueur..."
              className="ml-auto rounded-lg bg-input border border-border-t px-3 py-1.5 text-xs text-text-primary placeholder:text-text-faint outline-none focus:border-accent w-48"
            />
          )}
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border-t/50">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Joueur</span>
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{board.unit}</span>
        </div>

        {/* Players list */}
        <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
          {displayPlayers.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-text-muted">
              {search ? "Aucun résultat" : "Aucune donnée disponible"}
            </div>
          ) : (
            <div className="divide-y divide-border-t/50">
              {displayPlayers.map((player, i) => (
                <PlayerRow
                  key={`${player.rank}-${player.name}`}
                  player={player}
                  displayRank={mode === "full" && search ? i + 1 + page * PAGE_SIZE : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination (full mode) or dots (top10 mode) */}
        <div className="flex items-center justify-center gap-1.5 py-3 border-t border-border-t/50">
          {mode === "full" && totalPages > 1 ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-text-muted tabular-nums">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredFull.length)} sur {filteredFull.length}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            boards.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  active === i ? "w-6 bg-accent" : "w-1.5 bg-text-faint/50 hover:bg-text-muted"
                }`}
              />
            ))
          )}
        </div>
      </div>

      {/* Right arrow */}
      <button
        onClick={() => go(1)}
        className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border-t text-text-muted hover:bg-input hover:text-text-primary transition-colors"
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
}
