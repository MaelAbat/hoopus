"use client";

import { useState } from "react";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";
import Link from "next/link";

interface PlayerLine {
  player_id: number;
  player_name: string;
  team: string;
  starter: boolean;
  position: string | null;
  jersey: string | null;
  minutes: string;
  pts: number;
  reb: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  plus_minus: number;
}

const STAT_COLS = [
  { key: "minutes", label: "MIN", format: "str" },
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV" },
  { key: "pf", label: "PF" },
  { key: "fgm_fga", label: "FG", format: "split" },
  { key: "fg3m_fg3a", label: "3PT", format: "split" },
  { key: "ftm_fta", label: "FT", format: "split" },
  { key: "oreb", label: "OR" },
  { key: "dreb", label: "DR" },
  { key: "plus_minus", label: "+/-", format: "pm" },
];

function getVal(p: PlayerLine, key: string): string {
  if (key === "fgm_fga") return `${p.fgm}-${p.fga}`;
  if (key === "fg3m_fg3a") return `${p.fg3m}-${p.fg3a}`;
  if (key === "ftm_fta") return `${p.ftm}-${p.fta}`;
  if (key === "minutes") return p.minutes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (p as any)[key];
  return v != null ? String(v) : "0";
}

function TeamTable({
  team,
  teamName,
  players,
}: {
  team: string;
  teamName: string;
  players: PlayerLine[];
}) {
  const starters = players.filter((p) => p.starter);
  const bench = players.filter((p) => !p.starter);

  // Team totals
  const totals = players.reduce(
    (acc, p) => {
      acc.pts += p.pts;
      acc.reb += p.reb;
      acc.ast += p.ast;
      acc.stl += p.stl;
      acc.blk += p.blk;
      acc.tov += p.tov;
      acc.fgm += p.fgm;
      acc.fga += p.fga;
      acc.fg3m += p.fg3m;
      acc.fg3a += p.fg3a;
      acc.ftm += p.ftm;
      acc.fta += p.fta;
      acc.oreb += p.oreb;
      acc.dreb += p.dreb;
      acc.pf += p.pf;
      return acc;
    },
    { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, pf: 0 }
  );

  return (
    <div className="bg-card border border-rule overflow-hidden">
      {/* Team header — lower-third */}
      <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
        <span className="block h-4 w-1 bg-accent shrink-0" />
        <img src={teamLogoUrl(team)} alt={team} className="h-6 w-6 object-contain" />
        <span className="font-display text-lg text-text-primary">{teamName}</span>
        <span className="kicker text-text-faint">{team}</span>
      </div>

      <div className="overflow-x-auto scrollbar-visible">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-rule bg-card">
              <th className="sticky left-0 z-10 bg-card text-left px-3 py-2 kicker text-text-faint min-w-[130px] sm:min-w-[180px]">
                Joueur
              </th>
              {STAT_COLS.map((col) => (
                <th key={col.key} className="px-2 py-2 text-center kicker text-text-faint whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Starters */}
            {starters.length > 0 && (
              <tr>
                <td colSpan={STAT_COLS.length + 1} className="px-3 py-1.5 kicker text-accent-text bg-accent-light">
                  Titulaires
                </td>
              </tr>
            )}
            {starters.map((p) => (
              <PlayerRow key={p.player_id} player={p} />
            ))}

            {/* Bench */}
            {bench.length > 0 && (
              <tr>
                <td colSpan={STAT_COLS.length + 1} className="px-3 py-1.5 kicker text-text-muted bg-input/40">
                  Remplacants
                </td>
              </tr>
            )}
            {bench.map((p) => (
              <PlayerRow key={p.player_id} player={p} />
            ))}

            {/* Totals */}
            <tr className="border-t-2 border-border-hover bg-input/30">
              <td className="sticky left-0 z-10 bg-input/30 px-3 py-2.5 kicker text-text-primary">
                Total
              </td>
              <td className="px-2 py-2.5 text-center text-text-faint">-</td>
              <td className="px-2 py-2.5 text-center tnum font-bold text-text-primary">{totals.pts}</td>
              <td className="px-2 py-2.5 text-center tnum font-bold text-text-primary">{totals.reb}</td>
              <td className="px-2 py-2.5 text-center tnum font-bold text-text-primary">{totals.ast}</td>
              <td className="px-2 py-2.5 text-center tnum text-text-primary">{totals.stl}</td>
              <td className="px-2 py-2.5 text-center tnum text-text-primary">{totals.blk}</td>
              <td className="px-2 py-2.5 text-center tnum text-text-primary">{totals.tov}</td>
              <td className="px-2 py-2.5 text-center tnum text-text-primary">{totals.pf}</td>
              <td className="px-2 py-2.5 text-center tnum text-text-primary">{totals.fgm}-{totals.fga}</td>
              <td className="px-2 py-2.5 text-center tnum text-text-primary">{totals.fg3m}-{totals.fg3a}</td>
              <td className="px-2 py-2.5 text-center tnum text-text-primary">{totals.ftm}-{totals.fta}</td>
              <td className="px-2 py-2.5 text-center tnum text-text-primary">{totals.oreb}</td>
              <td className="px-2 py-2.5 text-center tnum text-text-primary">{totals.dreb}</td>
              <td className="px-2 py-2.5 text-center text-text-faint">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerRow({ player: p }: { player: PlayerLine }) {
  return (
    <tr className="border-b border-rule hover:bg-card-hover transition-colors duration-150 cursor-pointer">
      <td className="sticky left-0 z-10 bg-card hover:bg-card-hover px-3 py-2">
        <Link href={`/joueurs/${p.player_id}`} className="flex items-center gap-2 group">
          <div className="relative h-7 w-7 shrink-0">
            <img
              src={playerPhotoUrl(p.player_id)}
              alt=""
              className="h-7 w-7 object-cover bg-input"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-text-primary truncate text-[12px] group-hover:text-accent transition-colors">
              {p.player_name}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-text-faint">
              {p.position && <span>{p.position}</span>}
              {p.jersey && <span className="tnum"> #{p.jersey}</span>}
            </p>
          </div>
        </Link>
      </td>
      {STAT_COLS.map((col) => {
        const val = getVal(p, col.key);
        const isPM = col.format === "pm";
        const num = Number(val);
        return (
          <td
            key={col.key}
            className={`px-2 py-2 text-center tnum whitespace-nowrap ${
              col.key === "pts" && p.pts >= 20
                ? "font-bold text-accent-text"
                : isPM
                  ? num > 0
                    ? "text-emerald-500"
                    : num < 0
                      ? "text-red-500"
                      : "text-text-muted"
                  : "text-text-primary"
            }`}
          >
            {isPM && num > 0 ? `+${val}` : val}
          </td>
        );
      })}
    </tr>
  );
}

export default function BoxScore({
  awayTeam,
  homeTeam,
  awayTeamName,
  homeTeamName,
  awayPlayers,
  homePlayers,
}: {
  awayTeam: string;
  homeTeam: string;
  awayTeamName: string;
  homeTeamName: string;
  awayPlayers: PlayerLine[];
  homePlayers: PlayerLine[];
}) {
  const [activeTab, setActiveTab] = useState<"away" | "home">("away");

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex border border-rule bg-card w-fit max-w-full overflow-x-auto">
        <button
          onClick={() => setActiveTab("away")}
          className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === "away"
              ? "bg-accent text-white"
              : "text-text-muted hover:bg-input hover:text-text-primary"
          }`}
        >
          <img src={teamLogoUrl(awayTeam)} alt={awayTeam} className="h-4 w-4 object-contain" />
          {awayTeamName}
        </button>
        <button
          onClick={() => setActiveTab("home")}
          className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === "home"
              ? "bg-accent text-white"
              : "text-text-muted hover:bg-input hover:text-text-primary"
          }`}
        >
          <img src={teamLogoUrl(homeTeam)} alt={homeTeam} className="h-4 w-4 object-contain" />
          {homeTeamName}
        </button>
      </div>

      {/* Tables */}
      {activeTab === "away" && (
        <TeamTable team={awayTeam} teamName={awayTeamName} players={awayPlayers} />
      )}
      {activeTab === "home" && (
        <TeamTable team={homeTeam} teamName={homeTeamName} players={homePlayers} />
      )}
    </div>
  );
}
