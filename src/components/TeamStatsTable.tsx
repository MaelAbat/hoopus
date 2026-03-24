"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";

export interface TeamRow {
  team_name: string;
  team_tricode: string;
  [key: string]: string | number;
}

interface Column {
  key: string;
  label: string;
  short: string;
  format?: "pct" | "pct100" | "num" | "int" | "record";
  defaultDir?: "asc" | "desc";
}

const COLUMNS: Column[] = [
  { key: "record", label: "Bilan", short: "W-L", format: "record" },
  { key: "w_pct", label: "% Victoires", short: "W%" , format: "pct100" },
  { key: "off_rating", label: "Offensive Rating", short: "ORTG" },
  { key: "def_rating", label: "Defensive Rating", short: "DRTG", defaultDir: "asc" },
  { key: "net_rating", label: "Net Rating", short: "NET" },
  { key: "pace", label: "Pace", short: "PACE" },
  { key: "pts", label: "Points", short: "PTS" },
  { key: "reb", label: "Rebonds", short: "REB" },
  { key: "ast", label: "Passes", short: "AST" },
  { key: "stl", label: "Interceptions", short: "STL" },
  { key: "blk", label: "Contres", short: "BLK" },
  { key: "tov", label: "Pertes", short: "TOV", defaultDir: "asc" },
  { key: "fg_pct", label: "% Tir", short: "FG%", format: "pct100" },
  { key: "fg3_pct", label: "% 3pts", short: "3P%", format: "pct100" },
  { key: "ft_pct", label: "% LF", short: "FT%", format: "pct100" },
  { key: "ts_pct", label: "True Shooting %", short: "TS%", format: "pct100" },
  { key: "efg_pct", label: "Effective FG%", short: "eFG%", format: "pct100" },
  { key: "oreb", label: "Reb. off.", short: "OREB" },
  { key: "dreb", label: "Reb. def.", short: "DREB" },
  { key: "plus_minus", label: "+/-", short: "+/-" },
  { key: "pie", label: "PIE", short: "PIE", format: "pct100" },
];

type SortDir = "asc" | "desc";

function formatVal(val: number, col: Column): string {
  if (col.format === "pct100") return (val * 100).toFixed(1);
  if (col.format === "pct") return val.toFixed(1);
  if (col.format === "int") return String(Math.round(val));
  return val.toFixed(1);
}

export default function TeamStatsTable({ teams }: { teams: TeamRow[] }) {
  const [sortKey, setSortKey] = useState("net_rating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(col: Column) {
    if (sortKey === col.key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(col.key);
      setSortDir(col.defaultDir || "desc");
    }
  }

  const sorted = useMemo(() => {
    if (sortKey === "record") {
      return [...teams].sort((a, b) => {
        const aVal = Number(a.w_pct);
        const bVal = Number(b.w_pct);
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      });
    }
    return [...teams].sort((a, b) => {
      const av = Number(a[sortKey]) || 0;
      const bv = Number(b[sortKey]) || 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [teams, sortKey, sortDir]);

  if (teams.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border-t px-6 py-12 text-center text-text-muted">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border-t overflow-hidden flex flex-col">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border-t/50">
              <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider w-8">
                #
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider min-w-[160px]">
                Équipe
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col)}
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
            {sorted.map((team, i) => (
              <tr
                key={team.team_tricode}
                className="border-b border-border-t/30 transition-colors hover:bg-card-hover"
              >
                <td className="px-3 py-2.5">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
                    i === 0
                      ? "bg-accent/20 text-accent-text"
                      : i < 3
                        ? "bg-input text-text-primary"
                        : "text-text-muted"
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <img
                      src={teamLogoUrl(String(team.team_tricode))}
                      alt={String(team.team_tricode)}
                      className="h-6 w-6 shrink-0 object-contain"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary truncate text-sm">
                        {team.team_name}
                      </p>
                    </div>
                  </div>
                </td>
                {COLUMNS.map((col) => {
                  if (col.key === "record") {
                    return (
                      <td
                        key={col.key}
                        className={`px-2 py-2.5 text-right tabular-nums text-sm whitespace-nowrap ${
                          sortKey === col.key ? "text-accent font-bold" : "text-text-primary"
                        }`}
                      >
                        {team.w}-{team.l}
                      </td>
                    );
                  }
                  const val = Number(team[col.key]) || 0;
                  return (
                    <td
                      key={col.key}
                      className={`px-2 py-2.5 text-right tabular-nums text-sm ${
                        sortKey === col.key ? "text-accent font-bold" : "text-text-primary"
                      }`}
                    >
                      {formatVal(val, col)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
