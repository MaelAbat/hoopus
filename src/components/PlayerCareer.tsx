"use client";

import { useEffect, useState } from "react";
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
}

export default function PlayerCareer({ playerId }: { playerId: number }) {
  const [seasons, setSeasons] = useState<SeasonStats[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/player-career?id=${playerId}`)
      .then((r) => r.json())
      .then((data) => setSeasons(data.seasons || []))
      .catch(() => setSeasons([]))
      .finally(() => setLoading(false));
  }, [playerId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-card border border-border-t p-6">
          <div className="h-6 w-32 animate-pulse rounded bg-input mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-input" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-card border border-border-t p-6">
          <div className="h-6 w-48 animate-pulse rounded bg-input mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-input" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!seasons || seasons.length === 0) {
    return null;
  }

  // Unique teams timeline (skip TOT = season totals for traded players)
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
        <div className="border-b border-border-t px-6 py-4">
          <h2 className="text-lg font-bold text-text-primary">Statistiques de carrière</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border-t text-text-muted">
                <th className="px-4 py-3 text-left font-medium">Saison</th>
                <th className="px-4 py-3 text-left font-medium">Équipe</th>
                <th className="px-4 py-3 text-center font-medium">MJ</th>
                <th className="px-4 py-3 text-center font-medium">MIN</th>
                <th className="px-4 py-3 text-center font-medium">PTS</th>
                <th className="px-4 py-3 text-center font-medium">REB</th>
                <th className="px-4 py-3 text-center font-medium">AST</th>
                <th className="px-4 py-3 text-center font-medium hidden sm:table-cell">STL</th>
                <th className="px-4 py-3 text-center font-medium hidden sm:table-cell">BLK</th>
                <th className="px-4 py-3 text-center font-medium hidden md:table-cell">FG%</th>
                <th className="px-4 py-3 text-center font-medium hidden md:table-cell">3P%</th>
                <th className="px-4 py-3 text-center font-medium hidden md:table-cell">FT%</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s, i) => {
                const isTot = s.team === "TOT";
                const logoUrl = isTot ? "" : teamLogoUrl(s.team);
                return (
                  <tr key={`${s.season}-${s.team}-${i}`} className={`border-b border-border-t/50 transition-colors hover:bg-card-hover ${isTot ? "bg-input/50" : ""}`}>
                    <td className="px-4 py-2.5 text-text-secondary font-medium">{s.season}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {logoUrl && <img src={logoUrl} alt={s.team} className="h-4 w-4 object-contain" />}
                        <span className={`font-medium ${isTot ? "text-text-muted italic" : "text-text-primary"}`}>
                          {isTot ? "Total" : s.team}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center text-text-muted">{s.gp}</td>
                    <td className="px-4 py-2.5 text-center text-text-muted">{s.min.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-text-primary">{s.pts.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-center text-text-muted">{s.reb.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-center text-text-muted">{s.ast.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-center text-text-muted hidden sm:table-cell">{s.stl.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-center text-text-muted hidden sm:table-cell">{s.blk.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-center text-text-muted hidden md:table-cell">{(s.fgPct * 100).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-center text-text-muted hidden md:table-cell">{(s.fg3Pct * 100).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-center text-text-muted hidden md:table-cell">{(s.ftPct * 100).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
