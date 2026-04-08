"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Trophy, List, Filter, Heart } from "lucide-react";
import Link from "next/link";
import type { PlayerStatLeader } from "@/lib/nba-api";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";
import { useFavorites } from "@/context/FavoritesContext";

interface Board {
  title: string;
  stat: string;
  unit: string;
  top10: PlayerStatLeader[];
  full: PlayerStatLeader[];
  eligibleCount: number;
}

type ViewMode = "top10" | "full";
type EligibilityFilter = "eligible" | "all";

const PAGE_SIZE = 50;

function PlayerRow({ player, displayRank }: { player: PlayerStatLeader; displayRank?: number }) {
  const rank = displayRank ?? player.rank;
  const { isPlayerFollowed } = useFavorites();
  const followed = isPlayerFollowed(player.player_id);
  return (
    <Link href={`/joueurs/${player.player_id}`} className={`flex items-center gap-3 sm:gap-4 px-3 sm:px-6 py-3.5 transition-all duration-150 hover:bg-card-hover hover:pl-4 sm:hover:pl-7 ${followed ? "bg-accent/5" : ""}`}>
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
      <div className="relative h-10 w-10 shrink-0">
        <img
          src={playerPhotoUrl(player.player_id)}
          alt=""
          className="h-10 w-10 rounded-full object-cover bg-input"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <img
          src={teamLogoUrl(player.team)}
          alt={player.team}
          className="absolute -bottom-0.5 -right-0.5 h-4 w-4 object-contain"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-text-primary truncate group-hover:text-accent transition-colors">{player.name}</p>
          {followed && <Heart size={12} className="shrink-0 fill-accent text-accent" />}
        </div>
        <p className="text-xs text-text-muted">{player.team}</p>
      </div>
      <span className="text-xl font-bold text-text-primary tabular-nums">
        {player.value}
      </span>
    </Link>
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
  const hasEligibility = board.eligibleCount >= 0;

  const fullPlayers = useMemo(() => {
    if (hasEligibility && eligibility === "eligible") {
      return board.full.filter((p) => p.rank <= board.eligibleCount);
    }
    if (hasEligibility && eligibility === "all") {
      return [...board.full]
        .sort((a, b) => Number(b.value) - Number(a.value))
        .map((p, i) => ({ ...p, rank: i + 1 }));
    }
    return board.full;
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

  const top10Players = board.full.filter((p) => p.rank >= 1 && p.rank <= 10);

  const displayPlayers = mode === "top10" ? top10Players : pagedPlayers;

  function go(dir: -1 | 1) {
    setActive((prev) => (prev + dir + boards.length) % boards.length);
  }

  // Touch swipe handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Lock into horizontal swipe if horizontal movement > vertical
    if (!swiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      swiping.current = true;
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      go(dx < 0 ? 1 : -1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards.length]);

  useEffect(() => {
    setPage(0);
    setSearch("");
  }, [active, mode, eligibility]);

  useEffect(() => {
    setEligibility("eligible");
  }, [active]);

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

  useEffect(() => {
    setPage(0);
  }, [search]);

  return (
    <div className="flex items-center gap-2 sm:gap-4 sm:h-[calc(100vh-14rem)]">
      <button
        onClick={() => go(-1)}
        className="hidden sm:flex shrink-0 h-10 w-10 items-center justify-center rounded-full bg-card border border-border-t text-text-muted hover:bg-input hover:text-text-primary transition-colors"
      >
        <ChevronLeft size={22} />
      </button>

      <div
        className="rounded-2xl bg-card border border-border-t overflow-hidden flex flex-col flex-1 h-full min-w-0"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
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

        {/* Controls bar */}
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-6 py-2.5 border-b border-border-t/50">
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
            </button>
          </div>

          {hasEligibility && (
            <div className="flex rounded-lg bg-input p-0.5">
              <button
                onClick={() => { setMode("full"); setEligibility("eligible"); }}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  mode === "full" && eligibility === "eligible"
                    ? "bg-card text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <Filter size={12} />
                Éligibles
                <span className="text-text-faint">({board.full.filter((p) => p.rank <= board.eligibleCount).length})</span>
              </button>
              <button
                onClick={() => { setMode("full"); setEligibility("all"); }}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  mode === "full" && eligibility === "all"
                    ? "bg-card text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                Tous
                <span className="text-text-faint">({board.full.length})</span>
              </button>
            </div>
          )}

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

        {/* Pagination top */}
        {mode === "full" && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-2 border-b border-border-t/50">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-text-muted tabular-nums">
              {page * PAGE_SIZE + 1}--{Math.min((page + 1) * PAGE_SIZE, filteredFull.length)} sur {filteredFull.length}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-border-t/50">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Joueur</span>
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{board.unit}</span>
        </div>

        {/* Players list */}
        <div ref={listRef} className="flex-1 sm:overflow-y-auto min-h-0">
          {displayPlayers.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-text-muted">
              {search ? "Aucun résultat" : "Aucune donnée disponible"}
            </div>
          ) : (
            <div className="divide-y divide-border-t/50">
              {displayPlayers.map((player, i) => (
                <PlayerRow
                  key={`${board.stat}-${player.player_id}-${player.name}`}
                  player={player}
                  displayRank={mode === "full" && search ? i + 1 + page * PAGE_SIZE : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
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
                {page * PAGE_SIZE + 1}--{Math.min((page + 1) * PAGE_SIZE, filteredFull.length)} sur {filteredFull.length}
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

      <button
        onClick={() => go(1)}
        className="hidden sm:flex shrink-0 h-10 w-10 items-center justify-center rounded-full bg-card border border-border-t text-text-muted hover:bg-input hover:text-text-primary transition-colors"
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
}
