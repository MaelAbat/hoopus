"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";

export interface PlayerRow {
  name: string;
  team: string;
  playerId: number;
  isEligible: boolean;
  stats: Record<string, number>;
}

interface Column {
  key: string;
  label: string;
  short: string;
}

const COLUMNS: Column[] = [
  { key: "GP", label: "Matchs joués", short: "GP" },
  { key: "MIN", label: "Minutes/match", short: "MIN" },
  { key: "TOT_MIN", label: "Minutes totales", short: "TMIN" },
  { key: "PTS", label: "Points", short: "PTS" },
  { key: "REB", label: "Rebonds", short: "REB" },
  { key: "AST", label: "Passes", short: "AST" },
  { key: "BLK", label: "Contres", short: "BLK" },
  { key: "STL", label: "Interceptions", short: "STL" },
  { key: "EFF", label: "Efficacité", short: "EFF" },
  { key: "TOV", label: "Pertes", short: "TOV" },
  { key: "FG_PCT", label: "% tir", short: "FG%" },
  { key: "FG2_PCT", label: "% 2pts", short: "2P%" },
  { key: "FG3_PCT", label: "% 3pts", short: "3P%" },
  { key: "FT_PCT", label: "% LF", short: "FT%" },
  { key: "TS_PCT", label: "TS%", short: "TS%" },
  { key: "EFG_PCT", label: "eFG%", short: "eFG%" },
];

const PAGE_SIZE = 50;

type SortDir = "asc" | "desc";

const GP_PRESETS = [0, 20, 40, 60];
const MIN_PRESETS = [0, 15, 20, 25, 30];
const USG_PRESETS = [0, 15, 20, 25, 30];

interface AttemptFilter {
  label: string;
  statKey: string;
  presets: number[];
}

const ATTEMPT_FILTERS: AttemptFilter[] = [
  { label: "FGA", statKey: "FGA_TOT", presets: [100, 200, 400, 600] },
  { label: "3PA", statKey: "FG3A_TOT", presets: [50, 100, 200, 300] },
  { label: "FTA", statKey: "FTA_TOT", presets: [50, 100, 200, 300] },
  { label: "2PA", statKey: "FG2A_TOT", presets: [50, 100, 200, 400] },
];

export default function StatsTable({ players }: { players: PlayerRow[] }) {
  const [sortKey, setSortKey] = useState("PTS");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [minGP, setMinGP] = useState(0);
  const [minMPG, setMinMPG] = useState(0);
  const [minUSG, setMinUSG] = useState(0);
  const [minAttempts, setMinAttempts] = useState<Record<string, number>>({});
  const [showFilters, setShowFilters] = useState(false);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "TOV" ? "asc" : "desc");
    }
    setPage(0);
  }

  function setAttempt(key: string, val: number) {
    setMinAttempts((prev) => ({ ...prev, [key]: val }));
    setPage(0);
  }

  const filtered = useMemo(() => {
    let list = players;
    if (minGP > 0) {
      list = list.filter((p) => (p.stats.GP ?? 0) >= minGP);
    }
    if (minMPG > 0) {
      list = list.filter((p) => (p.stats.MIN ?? 0) >= minMPG);
    }
    if (minUSG > 0) {
      list = list.filter((p) => (p.stats.USG_PCT ?? 0) >= minUSG);
    }
    for (const [key, val] of Object.entries(minAttempts)) {
      if (val > 0) {
        list = list.filter((p) => (p.stats[key] ?? 0) >= val);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
      );
    }
    return list;
  }, [players, search, minGP, minMPG, minUSG, minAttempts]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a.stats[sortKey] ?? 0;
      const bv = b.stats[sortKey] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const activeAttemptCount = Object.values(minAttempts).filter((v) => v > 0).length;
  const activeFilterCount = (minGP > 0 ? 1 : 0) + (minMPG > 0 ? 1 : 0) + (minUSG > 0 ? 1 : 0) + activeAttemptCount;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="bg-card border border-rule overflow-hidden flex flex-col sm:h-[calc(100vh-14rem)]">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-rule">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors border ${
            showFilters || hasActiveFilters
              ? "bg-accent-light border-accent text-accent"
              : "bg-input border-rule text-text-muted hover:border-border-hover hover:text-text-primary"
          }`}
        >
          <SlidersHorizontal size={13} />
          Filtres
          {hasActiveFilters && (
            <span className="tnum flex h-4 min-w-[16px] items-center justify-center bg-accent text-[9px] text-white font-bold px-1">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Active filter pills */}
        {hasActiveFilters && !showFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {minGP > 0 && (
              <span className="inline-flex items-center gap-1 bg-accent-light px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                GP <span className="tnum">{minGP}+</span>
                <button type="button" aria-label="Retirer le filtre GP" onClick={() => { setMinGP(0); setPage(0); }} className="hover:text-accent-text"><X size={10} /></button>
              </span>
            )}
            {minMPG > 0 && (
              <span className="inline-flex items-center gap-1 bg-accent-light px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                MPG <span className="tnum">{minMPG}+</span>
                <button type="button" aria-label="Retirer le filtre MPG" onClick={() => { setMinMPG(0); setPage(0); }} className="hover:text-accent-text"><X size={10} /></button>
              </span>
            )}
            {minUSG > 0 && (
              <span className="inline-flex items-center gap-1 bg-accent-light px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                USG% <span className="tnum">{minUSG}+</span>
                <button type="button" aria-label="Retirer le filtre USG" onClick={() => { setMinUSG(0); setPage(0); }} className="hover:text-accent-text"><X size={10} /></button>
              </span>
            )}
            {Object.entries(minAttempts).filter(([, v]) => v > 0).map(([key, val]) => {
              const af = ATTEMPT_FILTERS.find((f) => f.statKey === key);
              return (
                <span key={key} className="inline-flex items-center gap-1 bg-accent-light px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                  {af?.label ?? key} <span className="tnum">{val}+</span>
                  <button type="button" aria-label={`Retirer le filtre ${af?.label ?? key}`} onClick={() => setAttempt(key, 0)} className="hover:text-accent-text"><X size={10} /></button>
                </span>
              );
            })}
          </div>
        )}

        <span className="tnum font-mono text-[11px] uppercase tracking-wider text-text-faint ml-auto mr-2">
          {filtered.length} joueur{filtered.length > 1 ? "s" : ""}
        </span>

        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Rechercher..."
          aria-label="Rechercher un joueur"
          className="bg-input border border-rule px-3 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-faint outline-none focus:border-accent w-44"
        />
      </div>

      {/* ── Filters panel ── */}
      {showFilters && (
        <div className="border-b border-rule bg-card-hover/30 px-5 py-3 space-y-3">
          {/* Section: Temps de jeu */}
          <div className="space-y-1.5">
            <p className="kicker text-text-faint">Temps de jeu</p>
            <div className="flex flex-wrap items-center gap-3">
              <FilterRow label="GP" value={minGP} presets={GP_PRESETS}
                onChange={(v) => { setMinGP(v); setPage(0); }} />
              <FilterRow label="MPG" value={minMPG} presets={MIN_PRESETS}
                onChange={(v) => { setMinMPG(v); setPage(0); }} />
              <FilterRow label="USG%" value={minUSG} presets={USG_PRESETS}
                onChange={(v) => { setMinUSG(v); setPage(0); }} />
            </div>
          </div>

          <div className="h-px bg-rule" />

          {/* Section: Tentatives */}
          <div className="space-y-1.5">
            <p className="kicker text-text-faint">Tentatives saison</p>
            <div className="flex flex-wrap items-center gap-3">
              {ATTEMPT_FILTERS.map((af) => (
                <FilterRow key={af.statKey} label={af.label} value={minAttempts[af.statKey] || 0}
                  presets={[0, ...af.presets]}
                  onChange={(v) => setAttempt(af.statKey, v)} />
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <>
              <div className="h-px bg-rule" />
              <button
                onClick={() => { setMinGP(0); setMinMPG(0); setMinUSG(0); setMinAttempts({}); setPage(0); }}
                className="font-mono text-[11px] uppercase tracking-wider text-accent-text hover:text-accent transition-colors"
              >
                Réinitialiser tous les filtres
              </button>
            </>
          )}
        </div>
      )}

      {/* Pagination top */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2 border-b border-rule">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 py-1 text-text-muted hover:bg-input hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="tnum font-mono text-[11px] uppercase tracking-wider text-text-muted">
            {page * PAGE_SIZE + 1}--{Math.min((page + 1) * PAGE_SIZE, sorted.length)} sur {sorted.length}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 py-1 text-text-muted hover:bg-input hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-x-auto sm:overflow-auto min-h-0">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-rule">
              <th className="kicker text-left px-3 py-2.5 text-text-faint w-8">
                #
              </th>
              <th className="kicker text-left px-3 py-2.5 text-text-faint min-w-[140px] sm:min-w-[200px]">
                Joueur
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-2 py-2.5 text-right cursor-pointer select-none whitespace-nowrap transition-colors hover:text-text-primary"
                  title={col.label}
                >
                  <span className={`kicker inline-flex items-center gap-0.5 ${
                    sortKey === col.key ? "text-accent" : "text-text-faint"
                  }`}>
                    {col.short}
                    {sortKey === col.key && (
                      sortDir === "desc"
                        ? <ChevronDown size={12} />
                        : <ChevronUp size={12} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-4 py-12 text-center text-text-muted">
                  {search ? "Aucun résultat" : "Aucune donnée"}
                </td>
              </tr>
            ) : (
              paged.map((player, i) => {
                const rank = page * PAGE_SIZE + i + 1;
                return (
                  <tr
                    key={`${player.name}-${player.team}`}
                    className="border-b border-rule transition-colors duration-150 hover:bg-card-hover cursor-pointer"
                  >
                    <td className="px-3 py-2.5">
                      <span className={`tnum inline-flex h-6 w-6 items-center justify-center text-xs font-bold ${
                        rank === 1
                          ? "bg-accent text-white"
                          : rank <= 3
                            ? "bg-input text-text-primary"
                            : "text-text-faint"
                      }`}>
                        {rank}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/joueurs/${player.playerId}`} className="flex items-center gap-2.5 group">
                        <div className="relative h-9 w-9 shrink-0">
                          <img
                            src={playerPhotoUrl(player.playerId)}
                            alt=""
                            className="h-9 w-9 object-cover bg-input"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <img
                            src={teamLogoUrl(player.team)}
                            alt={player.team}
                            className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-text-primary truncate text-sm group-hover:text-accent-text transition-colors">{player.name}</p>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{player.team}</p>
                        </div>
                      </Link>
                    </td>
                    {COLUMNS.map((col) => {
                      const val = player.stats[col.key];
                      const isInt = col.key === "GP";
                      const isActiveSort = sortKey === col.key;
                      const displayVal = val != null ? (isInt ? Math.round(val) : val.toFixed(2)) : "N/A";
                      return (
                        <td
                          key={col.key}
                          className={`tnum px-2 py-2.5 text-right text-sm ${
                            isActiveSort
                              ? "text-accent font-bold"
                              : "text-text-primary"
                          }`}
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-3 border-t border-rule">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 py-1 text-text-muted hover:bg-input hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="tnum font-mono text-[11px] uppercase tracking-wider text-text-muted">
            {page * PAGE_SIZE + 1}--{Math.min((page + 1) * PAGE_SIZE, sorted.length)} sur {sorted.length}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 py-1 text-text-muted hover:bg-input hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Reusable filter chip ─── */

function FilterRow({ label, value, presets, onChange }: {
  label: string;
  value: number;
  presets: number[];
  onChange: (v: number) => void;
}) {
  const isActive = value > 0;
  return (
    <div className="flex items-center gap-2">
      <span className={`font-mono text-[11px] font-semibold uppercase tracking-wider ${isActive ? "text-accent" : "text-text-muted"}`}>
        {label}
      </span>
      <div className="inline-flex border border-rule bg-input">
        {presets.map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`tnum min-w-[34px] py-1 text-[10px] font-medium text-center transition-colors ${
              value === v
                ? "bg-card text-text-primary"
                : "text-text-faint hover:text-text-muted"
            }`}
          >
            {v === 0 ? "--" : `${v}+`}
          </button>
        ))}
      </div>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        placeholder="..."
        className="tnum w-11 bg-input border border-rule px-1 py-1 text-[10px] text-text-primary text-center outline-none focus:border-accent placeholder:text-text-faint/50"
      />
    </div>
  );
}
