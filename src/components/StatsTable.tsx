"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Filter } from "lucide-react";

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

export interface PlayerRow {
  name: string;
  team: string;
  isEligible: boolean;
  stats: Record<string, number>;
}

interface Column {
  key: string;
  label: string;
  short: string;
}

const COLUMNS: Column[] = [
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
];

const PAGE_SIZE = 50;

type SortDir = "asc" | "desc";

export default function StatsTable({ players }: { players: PlayerRow[] }) {
  const [sortKey, setSortKey] = useState("PTS");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [eligibleOnly, setEligibleOnly] = useState(true);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "TOV" ? "asc" : "desc");
    }
    setPage(0);
  }

  const filtered = useMemo(() => {
    let list = players;
    if (eligibleOnly) {
      list = list.filter((p) => p.isEligible);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
      );
    }
    return list;
  }, [players, search, eligibleOnly]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a.stats[sortKey] ?? 0;
      const bv = b.stats[sortKey] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="rounded-2xl bg-card border border-border-t overflow-hidden flex flex-col h-[calc(100vh-14rem)]">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border-t/50">
        <div className="flex rounded-lg bg-input p-0.5">
          <button
            onClick={() => { setEligibleOnly(true); setPage(0); }}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
              eligibleOnly
                ? "bg-card text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Filter size={12} />
            Éligibles
          </button>
          <button
            onClick={() => { setEligibleOnly(false); setPage(0); }}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
              !eligibleOnly
                ? "bg-card text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Tous
            <span className="text-text-faint">({players.length})</span>
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Rechercher un joueur..."
          className="ml-auto rounded-lg bg-input border border-border-t px-3 py-1.5 text-xs text-text-primary placeholder:text-text-faint outline-none focus:border-accent w-48"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border-t/50">
              <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider w-8">
                #
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider min-w-[180px]">
                Joueur
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-2 py-2.5 text-right text-xs font-medium uppercase tracking-wider cursor-pointer select-none whitespace-nowrap transition-colors hover:text-text-primary"
                  title={col.label}
                >
                  <span className={`inline-flex items-center gap-0.5 ${
                    sortKey === col.key ? "text-accent" : "text-text-muted"
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
                    className="border-b border-border-t/30 transition-colors hover:bg-card-hover"
                  >
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
                        rank === 1
                          ? "bg-accent/20 text-accent-text"
                          : rank <= 3
                            ? "bg-input text-text-primary"
                            : "text-text-muted"
                      }`}>
                        {rank}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <img
                          src={teamLogoUrl(player.team)}
                          alt={player.team}
                          className="h-5 w-5 shrink-0 object-contain"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-text-primary truncate text-sm">{player.name}</p>
                          <p className="text-[10px] text-text-muted">{player.team}</p>
                        </div>
                      </div>
                    </td>
                    {COLUMNS.map((col) => {
                      const val = player.stats[col.key];
                      const isPercent = col.key.includes("PCT");
                      return (
                        <td
                          key={col.key}
                          className={`px-2 py-2.5 text-right tabular-nums text-sm ${
                            sortKey === col.key
                              ? "text-accent font-bold"
                              : "text-text-primary"
                          }`}
                        >
                          {val != null ? (isPercent ? val.toFixed(2) : val.toFixed(2)) : "—"}
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
        <div className="flex items-center justify-center gap-3 py-3 border-t border-border-t/50">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-text-muted tabular-nums">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} sur {sorted.length}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
