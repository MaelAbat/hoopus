"use client";

import { teamLogoUrl } from "@/lib/nba-teams";
import Link from "next/link";

interface LeaderRow {
  category: string;
  rank: number;
  player_name: string;
  player_id: number;
  team: string;
  value: number;
}

interface PlayoffTeamStat {
  team_id: number;
  team_name: string;
  team_tricode: string;
  gp: number;
  w: number;
  l: number;
  pts: number;
  reb: number;
  ast: number;
  off_rating: number;
  def_rating: number;
  net_rating: number;
  ts_pct: number;
}

interface Props {
  leaders: LeaderRow[];
  teamStats: PlayoffTeamStat[];
}

interface BoardDef {
  category: string;
  title: string;
  unit: string;
  format: (v: number) => string;
}

const BOARDS: BoardDef[] = [
  { category: "PTS", title: "Points", unit: "PPG", format: (v) => v.toFixed(1) },
  { category: "REB", title: "Rebonds", unit: "RPG", format: (v) => v.toFixed(1) },
  { category: "AST", title: "Passes", unit: "APG", format: (v) => v.toFixed(1) },
  { category: "STL", title: "Interceptions", unit: "SPG", format: (v) => v.toFixed(1) },
  { category: "BLK", title: "Contres", unit: "BPG", format: (v) => v.toFixed(1) },
  { category: "FG_PCT", title: "% au tir", unit: "FG%", format: (v) => v.toFixed(1) + "%" },
  { category: "FG3_PCT", title: "% à 3pts", unit: "3P%", format: (v) => v.toFixed(1) + "%" },
  { category: "TS_PCT", title: "True shooting", unit: "TS%", format: (v) => v.toFixed(1) + "%" },
];

function MiniLeaderboard({ board, rows }: { board: BoardDef; rows: LeaderRow[] }) {
  const top = rows
    .filter((r) => r.category === board.category && r.rank > 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10);

  return (
    <div className="border border-rule bg-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-rule">
        <h3 className="font-display text-base text-text-primary">{board.title}</h3>
        <span className="kicker text-text-faint">{board.unit}</span>
      </div>
      {top.length === 0 ? (
        <p className="text-xs text-text-faint text-center py-6">Pas encore de donnée éligible</p>
      ) : (
        <ol className="divide-y divide-rule">
          {top.map((r, i) => (
            <li key={`${r.player_id}-${r.category}`}>
              <Link
                href={r.player_id ? `/joueurs/${r.player_id}` : "#"}
                className="group flex items-center gap-2 px-2 py-1.5 hover:bg-input/50 transition-colors"
              >
                <span className={`tnum w-5 text-[11px] font-bold text-right ${i === 0 ? "text-accent-text" : "text-text-faint"}`}>
                  {r.rank}
                </span>
                <img src={teamLogoUrl(r.team)} alt={r.team} className="h-4 w-4 shrink-0 object-contain" />
                <span className="flex-1 truncate text-xs font-medium text-text-primary group-hover:text-accent-text transition-colors">
                  {r.player_name}
                </span>
                <span className="tnum text-xs font-bold text-text-primary">
                  {board.format(Number(r.value))}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TeamStatsTable({ teams }: { teams: PlayoffTeamStat[] }) {
  if (teams.length === 0) return null;

  const sorted = [...teams].sort((a, b) => b.net_rating - a.net_rating);

  return (
    <div className="border border-rule bg-card overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-rule">
        <h3 className="font-display text-xl text-text-primary">Statistiques par équipe</h3>
        <p className="kicker text-text-faint mt-1">Classé par Net Rating</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-rule">
              <th className="kicker text-text-faint text-left px-3 py-2">Équipe</th>
              <th className="kicker text-text-faint text-right px-3 py-2">G</th>
              <th className="kicker text-text-faint text-right px-3 py-2">V-D</th>
              <th className="kicker text-text-faint text-right px-3 py-2">PTS</th>
              <th className="kicker text-text-faint text-right px-3 py-2">REB</th>
              <th className="kicker text-text-faint text-right px-3 py-2">AST</th>
              <th className="kicker text-text-faint text-right px-3 py-2">OFF</th>
              <th className="kicker text-text-faint text-right px-3 py-2">DEF</th>
              <th className="kicker text-text-faint text-right px-3 py-2">NET</th>
              <th className="kicker text-text-faint text-right px-3 py-2">TS%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {sorted.map((t) => (
              <tr key={t.team_id} className="hover:bg-card-hover transition-colors">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <img src={teamLogoUrl(t.team_tricode)} alt={t.team_tricode} className="h-5 w-5 shrink-0 object-contain" />
                    <span className="font-bold uppercase tracking-wide text-text-primary">{t.team_tricode}</span>
                  </div>
                </td>
                <td className="tnum text-right text-text-muted px-3 py-2">{t.gp}</td>
                <td className="tnum text-right text-text-primary px-3 py-2">{t.w}-{t.l}</td>
                <td className="tnum text-right text-text-primary px-3 py-2">{t.pts.toFixed(1)}</td>
                <td className="tnum text-right text-text-muted px-3 py-2">{t.reb.toFixed(1)}</td>
                <td className="tnum text-right text-text-muted px-3 py-2">{t.ast.toFixed(1)}</td>
                <td className="tnum text-right text-text-muted px-3 py-2">{t.off_rating.toFixed(1)}</td>
                <td className="tnum text-right text-text-muted px-3 py-2">{t.def_rating.toFixed(1)}</td>
                <td className={`tnum text-right font-bold px-3 py-2 ${t.net_rating > 0 ? "text-accent-text" : "text-text-muted"}`}>
                  {t.net_rating > 0 ? "+" : ""}{t.net_rating.toFixed(1)}
                </td>
                <td className="tnum text-right text-text-muted px-3 py-2">{(t.ts_pct * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PlayoffStatsPanel({ leaders, teamStats }: Props) {
  if (leaders.length === 0 && teamStats.length === 0) {
    return (
      <div className="border border-rule bg-card px-6 py-12 text-center">
        <p className="text-sm text-text-muted">Aucune statistique disponible pour les playoffs.</p>
        <p className="text-xs text-text-faint mt-2">
          Les leaders et stats d&apos;équipe apparaîtront ici dès le premier match. Lance
          <code className="mx-1 px-1.5 py-0.5 bg-input font-mono text-[11px]">npm run sync stats team-stats</code>
          pour synchroniser.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="font-display text-2xl text-text-primary sm:text-3xl">Leaders des playoffs</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {BOARDS.map((board) => (
            <MiniLeaderboard key={board.category} board={board} rows={leaders} />
          ))}
        </div>
      </div>
      {teamStats.length > 0 && <TeamStatsTable teams={teamStats} />}
    </div>
  );
}
