"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  SlidersHorizontal, X,
} from "lucide-react";
import Link from "next/link";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";
import type { PlayerRow } from "./StatsTable";

/* ─── Column definitions ─── */

interface Column {
  key: string;
  label: string;
  short: string;
  format?: "plus" | "rating" | "pct" | "int" | "default";
}

interface ColumnGroup {
  id: string;
  label: string;
  icon: string;
  columns: Column[];
  description?: string;
}

const COLUMN_GROUPS: ColumnGroup[] = [
  {
    id: "volume",
    label: "Volume",
    icon: "~",
    description: "Temps de jeu et rythme",
    columns: [
      { key: "GP", label: "Matchs joués", short: "GP", format: "int" },
      { key: "MIN", label: "Minutes / match", short: "MIN" },
      { key: "TOT_MIN", label: "Minutes totales", short: "TMIN", format: "int" },
      { key: "USG_PCT", label: "Usage Rate", short: "USG%", format: "pct" },
      { key: "PACE", label: "Pace", short: "PACE", format: "rating" },
    ],
  },
  {
    id: "ratings",
    label: "Ratings",
    icon: "~",
    description: "Offensive / defensive / net ratings",
    columns: [
      { key: "OFF_RATING", label: "Offensive Rating", short: "ORTG", format: "rating" },
      { key: "DEF_RATING", label: "Defensive Rating", short: "DRTG", format: "rating" },
      { key: "NET_RATING", label: "Net Rating", short: "NET", format: "rating" },
    ],
  },
  {
    id: "efficiency",
    label: "Efficacité",
    icon: "~",
    description: "True Shooting, eFG et impact",
    columns: [
      { key: "TS_PCT", label: "True Shooting %", short: "TS%", format: "pct" },
      { key: "EFG_PCT", label: "Effective FG%", short: "eFG%", format: "pct" },
      { key: "PIE", label: "Player Impact Estimate", short: "PIE", format: "pct" },
    ],
  },
  {
    id: "playmaking",
    label: "Playmaking & Rebounding",
    icon: "~",
    description: "Contribution aux passes et rebonds",
    columns: [
      { key: "AST_PCT", label: "Assist %", short: "AST%", format: "pct" },
      { key: "REB_PCT", label: "Rebound %", short: "REB%", format: "pct" },
      { key: "OREB_PCT", label: "Off. Rebound %", short: "OREB%", format: "pct" },
      { key: "DREB_PCT", label: "Def. Rebound %", short: "DREB%", format: "pct" },
    ],
  },
  {
    id: "adjusted",
    label: "Adjusted Shooting",
    icon: "~",
    description: "100 = moyenne de la ligue. >100 = au-dessus, <100 = en-dessous.",
    columns: [
      { key: "TS_PLUS", label: "TS+ (vs ligue)", short: "TS+", format: "plus" },
      { key: "EFG_PLUS", label: "eFG+ (vs ligue)", short: "eFG+", format: "plus" },
      { key: "FG_PLUS", label: "FG+ (vs ligue)", short: "FG+", format: "plus" },
      { key: "FG3_PLUS", label: "3P+ (vs ligue)", short: "3P+", format: "plus" },
      { key: "FT_PLUS", label: "FT+ (vs ligue)", short: "FT+", format: "plus" },
      { key: "FG2_PLUS", label: "2P+ (vs ligue)", short: "2P+", format: "plus" },
    ],
  },
  {
    id: "totals",
    label: "Totaux",
    icon: "~",
    description: "Cumuls saison (stats brutes, non par match)",
    columns: [
      { key: "PTS_TOT", label: "Points totaux", short: "PTS", format: "int" },
      { key: "REB_TOT", label: "Rebonds totaux", short: "REB", format: "int" },
      { key: "AST_TOT", label: "Passes totales", short: "AST", format: "int" },
      { key: "STL_TOT", label: "Interceptions totales", short: "STL", format: "int" },
      { key: "BLK_TOT", label: "Contres totaux", short: "BLK", format: "int" },
      { key: "TOV_TOT", label: "Pertes totales", short: "TOV", format: "int" },
      { key: "OREB_TOT", label: "Rebonds off. totaux", short: "OREB", format: "int" },
      { key: "DREB_TOT", label: "Rebonds def. totaux", short: "DREB", format: "int" },
      { key: "FGM_TOT", label: "Tirs reussis", short: "FGM", format: "int" },
      { key: "FGA_TOT", label: "Tirs tentes", short: "FGA", format: "int" },
      { key: "FG3M_TOT", label: "3pts reussis", short: "3PM", format: "int" },
      { key: "FG3A_TOT", label: "3pts tentes", short: "3PA", format: "int" },
      { key: "FG2M_TOT", label: "2pts reussis", short: "2PM", format: "int" },
      { key: "FG2A_TOT", label: "2pts tentes", short: "2PA", format: "int" },
      { key: "FTM_TOT", label: "LF reussis", short: "FTM", format: "int" },
      { key: "FTA_TOT", label: "LF tentes", short: "FTA", format: "int" },
      { key: "PF_TOT", label: "Fautes", short: "PF", format: "int" },
      { key: "PLUS_MINUS_TOT", label: "+/-", short: "+/-", format: "int" },
    ],
  },
];

const ALL_COLUMNS = COLUMN_GROUPS.flatMap((g) => g.columns);

/* ─── Helpers ─── */

const PAGE_SIZE = 50;
type SortDir = "asc" | "desc";

function formatValue(val: number | undefined, format?: string): string {
  if (val == null) return "N/A";
  switch (format) {
    case "int":
      return Math.round(val).toLocaleString();
    case "plus":
    case "rating":
    case "pct":
      return val.toFixed(1);
    default:
      return val.toFixed(2);
  }
}

// 100 = league average. Above/below is a true +/- variation, so a sober
// green/red is warranted per the design language; middle stays neutral ink.
function getPlusColor(val: number | undefined): string {
  if (val == null) return "text-text-faint text-xs";
  if (val >= 115) return "text-emerald-500 font-bold";
  if (val >= 108) return "text-emerald-500/80";
  if (val >= 102) return "text-text-primary";
  if (val >= 98) return "text-text-muted";
  if (val >= 92) return "text-red-500/70";
  return "text-red-500 font-bold";
}

function getPlusBg(val: number | undefined): string {
  if (val == null) return "";
  if (val >= 115) return "bg-emerald-500/10";
  if (val >= 108) return "bg-emerald-500/5";
  if (val < 92) return "bg-red-500/10";
  if (val < 98) return "bg-red-500/5";
  return "";
}

/* ─── Presets ─── */

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

/* ─── Component ─── */

export default function AdvancedStatsTable({ players }: { players: PlayerRow[] }) {
  const [activeGroup, setActiveGroup] = useState<string>("volume");
  const groupTabsRef = useRef<HTMLDivElement>(null);

  const scrollActiveGroupTab = useCallback(() => {
    const container = groupTabsRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLElement>("[data-active-group]");
    if (!activeBtn) return;
    const left = activeBtn.offsetLeft - container.offsetWidth / 2 + activeBtn.offsetWidth / 2;
    container.scrollTo({ left, behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollActiveGroupTab();
  }, [activeGroup, scrollActiveGroupTab]);

  const [sortKey, setSortKey] = useState("USG_PCT");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [minGP, setMinGP] = useState(0);
  const [minMPG, setMinMPG] = useState(0);
  const [minUSG, setMinUSG] = useState(0);
  const [minAttempts, setMinAttempts] = useState<Record<string, number>>({});
  const [showFilters, setShowFilters] = useState(false);

  const isAllView = activeGroup === "all";
  const currentGroup = COLUMN_GROUPS.find((g) => g.id === activeGroup);
  const visibleColumns = isAllView ? ALL_COLUMNS : (currentGroup?.columns ?? []);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "DEF_RATING" ? "asc" : "desc");
    }
    setPage(0);
  }

  function setAttempt(key: string, val: number) {
    setMinAttempts((prev) => ({ ...prev, [key]: val }));
    setPage(0);
  }

  const filtered = useMemo(() => {
    let list = players;
    if (minGP > 0) list = list.filter((p) => (p.stats.GP ?? 0) >= minGP);
    if (minMPG > 0) list = list.filter((p) => (p.stats.MIN ?? 0) >= minMPG);
    if (minUSG > 0) list = list.filter((p) => (p.stats.USG_PCT ?? 0) >= minUSG);
    for (const [key, val] of Object.entries(minAttempts)) {
      if (val > 0) list = list.filter((p) => (p.stats[key] ?? 0) >= val);
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

      {/* ── Group tabs ── */}
      <div ref={groupTabsRef} className="flex items-center gap-1 px-4 py-2.5 border-b border-rule overflow-x-auto no-scrollbar">
        {COLUMN_GROUPS.map((g) => (
          <button
            key={g.id}
            onClick={() => { setActiveGroup(g.id); setPage(0); }}
            {...(activeGroup === g.id ? { "data-active-group": true } : {})}
            className={`whitespace-nowrap px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              activeGroup === g.id
                ? "bg-accent text-white"
                : "text-text-muted hover:bg-input hover:text-text-primary"
            }`}
          >
            {g.label}
          </button>
        ))}
        <div className="w-px h-5 bg-rule mx-1" />
        <button
          onClick={() => { setActiveGroup("all"); setPage(0); }}
          {...(isAllView ? { "data-active-group": true } : {})}
          className={`whitespace-nowrap px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
            isAllView
              ? "bg-accent text-white"
              : "text-text-muted hover:bg-input hover:text-text-primary"
          }`}
        >
          Tout voir
        </button>
      </div>

      {/* ── Toolbar: filters + search ── */}
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

      {/* ── Group description ── */}
      {currentGroup?.description && !isAllView && (
        <div className="px-4 py-1.5 border-b border-rule bg-card-hover/30">
          <p className="font-mono text-[11px] uppercase tracking-wider text-text-faint">{currentGroup.description}</p>
        </div>
      )}

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

      {/* ── Pagination top ── */}
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
            {page * PAGE_SIZE + 1} -- {Math.min((page + 1) * PAGE_SIZE, sorted.length)} sur {sorted.length}
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

      {/* ── Table ── */}
      <div className="flex-1 overflow-x-auto sm:overflow-auto min-h-0 scrollbar-visible">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-20">
            {/* All-view group headers */}
            {isAllView && (
              <tr className="bg-card border-b border-rule">
                <th className="sm:sticky sm:left-0 sm:z-30 bg-card w-10" />
                <th className="sm:sticky sm:left-10 sm:z-30 bg-card" style={{ minWidth: 140 }} />
                {COLUMN_GROUPS.map((group) => (
                  <th
                    key={group.id}
                    colSpan={group.columns.length}
                    className="kicker px-2 py-1.5 text-center text-accent-text bg-card border-l border-rule first:border-l-0"
                  >
                    {group.label}
                  </th>
                ))}
              </tr>
            )}
            {/* Column headers */}
            <tr className="bg-card border-b border-rule">
              <th className="kicker sm:sticky sm:left-0 sm:z-30 text-left pl-4 pr-2 py-3 text-text-faint w-10 bg-card">
                #
              </th>
              <th className="kicker sm:sticky sm:left-10 sm:z-30 text-left px-3 py-3 text-text-faint bg-card sm:after:absolute sm:after:right-0 sm:after:top-0 sm:after:bottom-0 sm:after:w-px sm:after:bg-rule" style={{ minWidth: 140 }}>
                Joueur
              </th>
              {visibleColumns.map((col, ci) => {
                const isGroupStart = isAllView && COLUMN_GROUPS.some((g) => g.columns[0]?.key === col.key);
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-3 py-3 text-right cursor-pointer select-none whitespace-nowrap transition-colors hover:text-text-primary bg-card ${
                      isGroupStart && ci > 0 ? "border-l border-rule" : ""
                    }`}
                    title={col.label}
                  >
                    <span className={`kicker inline-flex items-center gap-0.5 ${
                      sortKey === col.key ? "text-accent" : "text-text-faint"
                    }`}>
                      {col.short}
                      {sortKey === col.key && (
                        sortDir === "desc" ? <ChevronDown size={11} /> : <ChevronUp size={11} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="px-4 py-16 text-center text-text-muted text-sm">
                  {search ? "Aucun résultat" : "Aucune donnée"}
                </td>
              </tr>
            ) : (
              paged.map((player, i) => {
                const rank = page * PAGE_SIZE + i + 1;
                return (
                  <tr
                    key={`${player.name}-${player.team}`}
                    className="border-b border-rule transition-colors duration-150 hover:bg-card-hover cursor-pointer group"
                  >
                    <td className="sm:sticky sm:left-0 sm:z-10 bg-card pl-4 pr-2 py-3 group-hover:bg-card-hover">
                      <span className={`tnum inline-flex h-6 w-6 items-center justify-center text-[11px] font-bold ${
                        rank === 1
                          ? "bg-accent text-white"
                          : rank <= 3
                            ? "bg-input text-text-primary"
                            : "text-text-faint"
                      }`}>
                        {rank}
                      </span>
                    </td>
                    <td className="sm:sticky sm:left-10 sm:z-10 bg-card px-3 py-3 group-hover:bg-card-hover sm:after:absolute sm:after:right-0 sm:after:top-0 sm:after:bottom-0 sm:after:w-px sm:after:bg-rule">
                      <Link href={`/joueurs/${player.playerId}`} className="flex items-center gap-3 group/link">
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
                          <p className="font-semibold text-text-primary truncate text-[13px] leading-tight transition-colors group-hover/link:text-accent-text">{player.name}</p>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-text-faint mt-0.5">{player.team}</p>
                        </div>
                      </Link>
                    </td>
                    {visibleColumns.map((col, ci) => {
                      const val = player.stats[col.key];
                      const isGroupStart = isAllView && COLUMN_GROUPS.some((g) => g.columns[0]?.key === col.key);
                      const isPlus = col.format === "plus";

                      return (
                        <td
                          key={col.key}
                          className={`tnum px-3 py-3 text-right text-[13px] ${
                            isGroupStart && ci > 0 ? "border-l border-rule" : ""
                          } ${
                            isPlus
                              ? `${getPlusColor(val)} ${getPlusBg(val)}`
                              : sortKey === col.key
                                ? "text-accent font-semibold"
                                : "text-text-primary"
                          }`}
                        >
                          {formatValue(val, col.format)}
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

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2.5 border-t border-rule">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 py-1 text-text-muted hover:bg-input hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="tnum font-mono text-[11px] uppercase tracking-wider text-text-muted">
            {page * PAGE_SIZE + 1} -- {Math.min((page + 1) * PAGE_SIZE, sorted.length)} sur {sorted.length}
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
