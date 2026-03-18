"use client";

import { Fragment, useMemo, useRef, useState } from "react";

interface Standing {
  id: string;
  conference: string;
  team_tricode: string;
  team_name: string;
  team_city: string;
  wins: number;
  losses: number;
  win_pct: number;
  home_record: string;
  road_record: string;
  last_10: string;
  streak: string;
  conference_rank: number;
}

type View = "east" | "west" | "league";

const HEADERS = [
  { key: "rank", label: "#", className: "w-10 text-left" },
  { key: "team", label: "Équipe", className: "text-left" },
  { key: "wins", label: "V", className: "text-center" },
  { key: "losses", label: "D", className: "text-center" },
  { key: "pct", label: "%", className: "text-center" },
  { key: "gb", label: "GB", className: "text-center" },
  { key: "home", label: "Dom.", className: "text-center hidden md:table-cell" },
  { key: "road", label: "Ext.", className: "text-center hidden md:table-cell" },
  { key: "l10", label: "L10", className: "text-center hidden lg:table-cell" },
  { key: "streak", label: "Série", className: "text-center hidden lg:table-cell" },
];

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

function computeGB(leader: Standing, team: Standing): string {
  if (leader === team) return "—";
  const gb = (leader.wins - team.wins + (team.losses - leader.losses)) / 2;
  if (gb === 0) return "—";
  return gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1);
}

function StandingsTable({ teams, showConference, scrollRef }: { teams: Standing[]; showConference?: boolean; scrollRef?: React.RefObject<HTMLDivElement | null> }) {
  const leader = teams[0];

  return (
    <div ref={scrollRef} className="overflow-x-auto max-h-[65vh] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border-t text-text-muted">
            {HEADERS.map((h) => (
              <th key={h.key} className={`px-4 py-3 font-medium ${h.className}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team, i) => {
            const rank = showConference ? i + 1 : team.conference_rank;
            const isPlayoff = team.conference_rank <= 6;
            const isPlayIn = team.conference_rank >= 7 && team.conference_rank <= 10;
            const showSeparator = !showConference && (i === 6 || i === 10);

            return (
              <Fragment key={team.id}>
                {showSeparator && (
                  <tr>
                    <td colSpan={10} className="p-0">
                      <div className="h-px bg-accent/30" />
                    </td>
                  </tr>
                )}
                <tr className="border-b border-border-t/50 transition-colors hover:bg-card-hover">
                  <td className="px-4 py-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                        rank === 1
                          ? "bg-accent/20 text-accent-text"
                          : isPlayoff
                            ? "text-text-primary"
                            : isPlayIn
                              ? "text-text-secondary"
                              : "text-text-faint"
                      }`}
                    >
                      {rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={teamLogoUrl(team.team_tricode)}
                        alt={team.team_tricode}
                        className="h-7 w-7 object-contain"
                      />
                      <div className="flex flex-col">
                        <span className={`font-medium ${isPlayoff ? "text-text-primary" : isPlayIn ? "text-text-secondary" : "text-text-muted"}`}>
                          {team.team_city} {team.team_name}
                        </span>
                        {showConference && (
                          <span className="text-[10px] text-text-faint">
                            {team.conference === "East" ? "Est" : "Ouest"} #{team.conference_rank}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-text-primary">{team.wins}</td>
                  <td className="px-4 py-3 text-center text-text-muted">{team.losses}</td>
                  <td className="px-4 py-3 text-center font-medium text-text-secondary">
                    {(team.win_pct * 100).toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-center text-text-muted">
                    {computeGB(leader, team)}
                  </td>
                  <td className="hidden px-4 py-3 text-center text-text-muted md:table-cell">{team.home_record}</td>
                  <td className="hidden px-4 py-3 text-center text-text-muted md:table-cell">{team.road_record}</td>
                  <td className="hidden px-4 py-3 text-center text-text-muted lg:table-cell">{team.last_10}</td>
                  <td className="hidden px-4 py-3 text-center lg:table-cell">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        team.streak.startsWith("W")
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {team.streak}
                    </span>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StandingsView({ east, west }: { east: Standing[]; west: Standing[] }) {
  const [view, setView] = useState<View>("east");
  const tableRef = useRef<HTMLDivElement>(null);

  function switchView(v: View) {
    setView(v);
    tableRef.current?.scrollTo({ top: 0 });
  }

  const leagueTeams = useMemo(
    () => [...east, ...west].sort((a, b) => b.win_pct - a.win_pct || b.wins - a.wins),
    [east, west]
  );

  const views: { key: View; label: string }[] = [
    { key: "east", label: "Est" },
    { key: "west", label: "Ouest" },
    { key: "league", label: "Ligue" },
  ];

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex gap-2">
        {views.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchView(key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
              view === key
                ? "bg-accent text-white"
                : "bg-input text-text-muted hover:bg-card-hover hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
        <div className="border-b border-border-t px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">
            {view === "east" ? "Conférence Est" : view === "west" ? "Conférence Ouest" : "Classement général"}
          </h2>
          <span className="text-xs text-text-faint">
            {view === "league" ? "30 équipes" : "15 équipes"}
          </span>
        </div>

        {(east.length === 0 && west.length === 0) ? (
          <div className="px-6 py-12 text-center text-sm text-text-muted">
            Aucune donnée disponible
          </div>
        ) : (
          <>
            <StandingsTable
              teams={view === "east" ? east : view === "west" ? west : leagueTeams}
              showConference={view === "league"}
              scrollRef={tableRef}
            />

            {/* Legend */}
            <div className="flex gap-6 px-6 py-3 border-t border-border-t">
              <span className="flex items-center gap-2 text-xs text-text-muted">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Playoffs (1-6)
              </span>
              <span className="flex items-center gap-2 text-xs text-text-muted">
                <span className="h-2 w-2 rounded-full bg-text-secondary" />
                Play-In (7-10)
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
