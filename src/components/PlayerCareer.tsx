"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { teamLogoUrl } from "@/lib/nba-teams";

interface SeasonStats {
  season: string;
  team: string;
  gp: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
  min: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  tov: number;
  pf: number;
  plusMinus: number;
  offRating: number;
  defRating: number;
  netRating: number;
  tsPct: number;
  efgPct: number;
  usgPct: number;
  pace: number;
  pie: number;
  astPct: number;
  orebPct: number;
  drebPct: number;
  rebPct: number;
  tsPlus: number;
  efgPlus: number;
  fgPlus: number;
  fg3Plus: number;
  ftPlus: number;
  fg2Plus: number;
}

interface Col {
  key: string;
  label: string;
  format: string;
  bold?: boolean;
  compute?: (s: SeasonStats) => number;
}

interface ColGroup {
  id: string;
  label: string;
  description?: string;
  columns: Col[];
}

const GROUPS: ColGroup[] = [
  {
    id: "base",
    label: "Base",
    columns: [
      { key: "gp", label: "MJ", format: "int" },
      { key: "min", label: "MIN", format: "dec1" },
      { key: "pts", label: "PTS", format: "dec1", bold: true },
      { key: "reb", label: "REB", format: "dec1" },
      { key: "ast", label: "AST", format: "dec1" },
      { key: "stl", label: "STL", format: "dec1" },
      { key: "blk", label: "BLK", format: "dec1" },
      { key: "tov", label: "TOV", format: "dec1" },
      { key: "pf", label: "PF", format: "dec1" },
      { key: "plusMinus", label: "+/-", format: "pm" },
    ],
  },
  {
    id: "volume",
    label: "Volume",
    description: "Temps de jeu et rythme",
    columns: [
      { key: "gp", label: "MJ", format: "int" },
      { key: "min", label: "MIN", format: "dec1" },
      { key: "_totMin", label: "TMIN", format: "int", compute: (s) => Math.round(s.min * s.gp) },
      { key: "usgPct", label: "USG%", format: "pct" },
      { key: "pace", label: "PACE", format: "rating" },
    ],
  },
  {
    id: "ratings",
    label: "Ratings",
    description: "Offensive / Defensive / Net Ratings",
    columns: [
      { key: "gp", label: "MJ", format: "int" },
      { key: "offRating", label: "ORTG", format: "rating" },
      { key: "defRating", label: "DRTG", format: "rating" },
      { key: "netRating", label: "NET", format: "net" },
    ],
  },
  {
    id: "efficiency",
    label: "Efficacité",
    description: "True Shooting, eFG et impact",
    columns: [
      { key: "gp", label: "MJ", format: "int" },
      { key: "tsPct", label: "TS%", format: "pct" },
      { key: "efgPct", label: "eFG%", format: "pct" },
      { key: "pie", label: "PIE", format: "pct" },
      { key: "fgPct", label: "FG%", format: "pct" },
      { key: "fg3Pct", label: "3P%", format: "pct" },
      { key: "ftPct", label: "FT%", format: "pct" },
    ],
  },
  {
    id: "playmaking",
    label: "Playmaking & Rebounding",
    description: "Contribution aux passes et rebonds",
    columns: [
      { key: "gp", label: "MJ", format: "int" },
      { key: "astPct", label: "AST%", format: "pct" },
      { key: "rebPct", label: "REB%", format: "pct" },
      { key: "orebPct", label: "OREB%", format: "pct" },
      { key: "drebPct", label: "DREB%", format: "pct" },
      { key: "_astTov", label: "AST/TOV", format: "ratio", compute: (s) => s.tov > 0 ? s.ast / s.tov : 0 },
    ],
  },
  {
    id: "shooting",
    label: "Tir",
    description: "Détail des tentatives et réussites",
    columns: [
      { key: "gp", label: "MJ", format: "int" },
      { key: "fgm", label: "FGM", format: "dec1" },
      { key: "fga", label: "FGA", format: "dec1" },
      { key: "fgPct", label: "FG%", format: "pct" },
      { key: "fg3m", label: "3PM", format: "dec1" },
      { key: "fg3a", label: "3PA", format: "dec1" },
      { key: "fg3Pct", label: "3P%", format: "pct" },
      { key: "ftm", label: "FTM", format: "dec1" },
      { key: "fta", label: "FTA", format: "dec1" },
      { key: "ftPct", label: "FT%", format: "pct" },
    ],
  },
  {
    id: "adjusted",
    label: "Adjusted Shooting",
    description: "100 = moyenne de la ligue. >100 = au-dessus, <100 = en-dessous.",
    columns: [
      { key: "gp", label: "MJ", format: "int" },
      { key: "tsPlus", label: "TS+", format: "plus" },
      { key: "efgPlus", label: "eFG+", format: "plus" },
      { key: "fgPlus", label: "FG+", format: "plus" },
      { key: "fg3Plus", label: "3P+", format: "plus" },
      { key: "ftPlus", label: "FT+", format: "plus" },
      { key: "fg2Plus", label: "2P+", format: "plus" },
    ],
  },
  {
    id: "totals",
    label: "Totaux",
    description: "Cumuls saison (stats brutes)",
    columns: [
      { key: "gp", label: "MJ", format: "int" },
      { key: "_totPts", label: "PTS", format: "int", bold: true, compute: (s) => Math.round(s.pts * s.gp) },
      { key: "_totReb", label: "REB", format: "int", compute: (s) => Math.round(s.reb * s.gp) },
      { key: "_totAst", label: "AST", format: "int", compute: (s) => Math.round(s.ast * s.gp) },
      { key: "_totStl", label: "STL", format: "int", compute: (s) => Math.round(s.stl * s.gp) },
      { key: "_totBlk", label: "BLK", format: "int", compute: (s) => Math.round(s.blk * s.gp) },
      { key: "_totTov", label: "TOV", format: "int", compute: (s) => Math.round(s.tov * s.gp) },
      { key: "_totFgm", label: "FGM", format: "int", compute: (s) => Math.round(s.fgm * s.gp) },
      { key: "_totFga", label: "FGA", format: "int", compute: (s) => Math.round(s.fga * s.gp) },
      { key: "_totFg3m", label: "3PM", format: "int", compute: (s) => Math.round(s.fg3m * s.gp) },
      { key: "_totFtm", label: "FTM", format: "int", compute: (s) => Math.round(s.ftm * s.gp) },
    ],
  },
];

function formatVal(val: number, format: string): string {
  if (format === "int") return String(Math.round(val));
  if (format === "dec1") return val.toFixed(1);
  if (format === "pct") return (val * 100).toFixed(1);
  if (format === "rating") return val.toFixed(1);
  if (format === "net") return (val > 0 ? "+" : "") + val.toFixed(1);
  if (format === "ratio") return val.toFixed(2);
  if (format === "pm") return val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
  if (format === "plus") return val ? Math.round(val).toString() : "N/A";
  return String(val);
}

function getVal(s: SeasonStats, col: Col): number {
  if (col.compute) return col.compute(s);
  return (s[col.key as keyof SeasonStats] as number) || 0;
}

function netClass(val: number, format: string): string {
  if (format === "pm" || format === "net") {
    if (val > 0) return "text-emerald-400";
    if (val < 0) return "text-red-400";
  }
  if (format === "plus" && val) {
    if (val > 100) return "text-emerald-400 font-medium";
    if (val < 100) return "text-red-400";
  }
  return "text-text-muted";
}

export default function PlayerCareer({ seasons }: { seasons: SeasonStats[] }) {
  const [activeGroup, setActiveGroup] = useState("base");
  const tabsRef = useRef<HTMLDivElement>(null);

  const scrollActiveTabIntoView = useCallback(() => {
    const container = tabsRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLElement>("[data-active-tab]");
    if (!activeBtn) return;
    const left = activeBtn.offsetLeft - container.offsetWidth / 2 + activeBtn.offsetWidth / 2;
    container.scrollTo({ left, behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollActiveTabIntoView();
  }, [activeGroup, scrollActiveTabIntoView]);

  if (seasons.length === 0) return null;

  const careerTeams: { team: string; first: string; last: string; count: number }[] = [];
  for (const s of seasons) {
    if (s.team === "TOT") continue;
    const last = careerTeams[careerTeams.length - 1];
    if (last && last.team === s.team) {
      last.last = s.season;
      last.count++;
    } else {
      careerTeams.push({ team: s.team, first: s.season, last: s.season, count: 1 });
    }
  }

  const group = GROUPS.find((g) => g.id === activeGroup) || GROUPS[0];

  return (
    <div className="space-y-6">
      {/* Teams timeline */}
      <div className="rounded-2xl bg-card border border-border-t p-6">
        <h2 className="mb-4 text-lg font-bold text-text-primary">Équipes</h2>
        <div className="space-y-2">
          {careerTeams.map((t, i) => {
            const logoUrl = teamLogoUrl(t.team);
            const span = t.first === t.last ? t.first : `${t.first} — ${t.last}`;
            return (
              <div key={`${t.team}-${i}`} className="flex items-center gap-3 rounded-xl bg-input px-4 py-3">
                {logoUrl && <img src={logoUrl} alt={t.team} className="h-6 w-6 object-contain" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{t.team}</p>
                  <p className="text-xs text-text-muted">{span}</p>
                </div>
                <span className="text-xs text-text-faint">
                  {t.count} saison{t.count > 1 ? "s" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Career stats table */}
      <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border-t px-4 sm:px-6 py-4">
          <h2 className="text-lg font-bold text-text-primary">Statistiques de carrière</h2>
          <div ref={tabsRef} className="flex rounded-lg bg-input p-0.5 overflow-x-auto no-scrollbar">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                {...(activeGroup === g.id ? { "data-active-tab": true } : {})}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                  activeGroup === g.id
                    ? "bg-card text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          {group.description && (
            <p className="text-[11px] text-text-faint">{group.description}</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border-t text-text-muted">
                <th className="sticky left-0 z-20 bg-card px-3 sm:px-4 py-3 text-left font-medium whitespace-nowrap">Saison</th>
                <th className="px-3 sm:px-4 py-3 text-left font-medium">Équipe</th>
                {group.columns.map((col) => (
                  <th key={col.key} className="px-2 sm:px-3 py-3 text-center font-medium whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seasons.map((s, i) => {
                const isTot = s.team === "TOT";
                const logoUrl = isTot ? "" : teamLogoUrl(s.team);
                return (
                  <tr key={`${s.season}-${s.team}-${i}`} className={`border-b border-border-t/50 transition-colors hover:bg-card-hover ${isTot ? "bg-input/50" : ""}`}>
                    <td className="sticky left-0 z-10 bg-card px-3 sm:px-4 py-2.5 text-text-secondary font-medium whitespace-nowrap">{s.season}</td>
                    <td className="px-3 sm:px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {logoUrl && <img src={logoUrl} alt={s.team} className="h-4 w-4 object-contain" />}
                        <span className={`font-medium ${isTot ? "text-text-muted italic" : "text-text-primary"}`}>
                          {isTot ? "Total" : s.team}
                        </span>
                      </div>
                    </td>
                    {group.columns.map((col) => {
                      const val = getVal(s, col);
                      return (
                        <td
                          key={col.key}
                          className={`px-2 sm:px-3 py-2.5 text-center whitespace-nowrap ${
                            col.bold ? "font-semibold text-text-primary" : netClass(val, col.format)
                          }`}
                        >
                          {formatVal(val, col.format)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Career averages row */}
              {(() => {
                // Only average non-TOT seasons
                const real = seasons.filter((s) => s.team !== "TOT");
                if (real.length === 0) return null;
                const totalGP = real.reduce((sum, s) => sum + s.gp, 0);
                return (
                  <tr className="border-t-2 border-accent/30 bg-card font-semibold">
                    <td className="sticky left-0 z-10 bg-card px-3 sm:px-4 py-3 text-accent-text whitespace-nowrap">Carrière</td>
                    <td className="px-3 sm:px-4 py-3 text-accent-text text-xs">{real.length} saisons</td>
                    {group.columns.map((col) => {
                      let avg: number;
                      if (col.compute) {
                        // For computed columns, compute on weighted averages
                        const fakeAvg: SeasonStats = {} as SeasonStats;
                        const keys: (keyof SeasonStats)[] = [
                          "gp","min","pts","reb","ast","stl","blk","fgm","fga","fg3m","fg3a",
                          "ftm","fta","oreb","dreb","tov","pf","plusMinus","offRating","defRating",
                          "netRating","tsPct","efgPct","usgPct","pace","pie","astPct","orebPct",
                          "drebPct","rebPct","tsPlus","efgPlus","fgPlus","fg3Plus","ftPlus","fg2Plus",
                          "fgPct","fg3Pct","ftPct",
                        ];
                        for (const k of keys) {
                          (fakeAvg as unknown as Record<string, number>)[k] = totalGP > 0
                            ? real.reduce((sum, s) => sum + (s[k] as number) * s.gp, 0) / totalGP
                            : 0;
                        }
                        fakeAvg.gp = totalGP;
                        avg = col.compute(fakeAvg);
                      } else if (col.format === "int" && col.key === "gp") {
                        avg = totalGP;
                      } else if (col.format === "plus") {
                        // Adjusted shooting: simple average (not GP-weighted, these are already per-season)
                        const vals = real.map((s) => (s[col.key as keyof SeasonStats] as number) || 0).filter(v => v > 0);
                        avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                      } else {
                        // GP-weighted average for per-game stats
                        avg = totalGP > 0
                          ? real.reduce((sum, s) => sum + (s[col.key as keyof SeasonStats] as number) * s.gp, 0) / totalGP
                          : 0;
                      }
                      return (
                        <td
                          key={col.key}
                          className={`px-2 sm:px-3 py-3 text-center whitespace-nowrap ${
                            col.bold ? "text-accent-text" : netClass(avg, col.format)
                          }`}
                        >
                          {formatVal(avg, col.format)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
