"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";
import { useFavorites } from "@/context/FavoritesContext";

const DIVISIONS: Record<string, { name: string; conference: string; teams: string[] }> = {
  atlantic: { name: "Atlantic", conference: "East", teams: ["BOS", "BKN", "NYK", "PHI", "TOR"] },
  central: { name: "Central", conference: "East", teams: ["CHI", "CLE", "DET", "IND", "MIL"] },
  southeast: { name: "Southeast", conference: "East", teams: ["ATL", "CHA", "MIA", "ORL", "WAS"] },
  northwest: { name: "Northwest", conference: "West", teams: ["DEN", "MIN", "OKC", "POR", "UTA"] },
  pacific: { name: "Pacific", conference: "West", teams: ["GSW", "LAC", "LAL", "PHX", "SAC"] },
  southwest: { name: "Southwest", conference: "West", teams: ["DAL", "HOU", "MEM", "NOP", "SAS"] },
};

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

type View = "east" | "west" | "league" | "divisions";

function getTrendIcon(last10: string) {
  const wins = parseInt(last10.split("-")[0], 10);
  if (isNaN(wins)) return <Minus size={12} className="text-text-faint" />;
  if (wins >= 7) return <TrendingUp size={12} className="text-accent-text" />;
  if (wins <= 3) return <TrendingDown size={12} className="text-text-muted" />;
  return <Minus size={12} className="text-text-faint" />;
}

const HEADERS = [
  { key: "wins", label: "V", className: "text-center" },
  { key: "losses", label: "D", className: "text-center" },
  { key: "pct", label: "%", className: "text-center" },
  { key: "gb", label: "GB", className: "text-center" },
  { key: "home", label: "Dom.", className: "text-center" },
  { key: "road", label: "Ext.", className: "text-center" },
  { key: "l10", label: "L10", className: "text-center" },
  { key: "streak", label: "Série", className: "text-center" },
];

function computeGB(leader: Standing, team: Standing): string {
  if (leader === team) return "\u2014";
  const gb = (leader.wins - team.wins + (team.losses - leader.losses)) / 2;
  if (gb === 0) return "\u2014";
  return gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1);
}

function StandingsTable({ teams, showConference, scrollRef }: { teams: Standing[]; showConference?: boolean; scrollRef?: React.RefObject<HTMLDivElement | null> }) {
  const leader = teams[0];
  const { isTeamFavorite } = useFavorites();
  const router = useRouter();

  return (
    <div ref={scrollRef} className="overflow-x-auto sm:max-h-[65vh] sm:overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-rule">
            <th className="sticky left-0 z-20 bg-card px-2 py-3 kicker text-text-faint text-left w-10">#</th>
            <th className="w-6 bg-card px-0 py-3" />
            <th className="sticky left-8 z-20 bg-card px-2 py-3 kicker text-text-faint text-left min-w-[100px] sm:min-w-[180px]">Équipe</th>
            {HEADERS.map((h) => (
              <th key={h.key} className={`px-2 sm:px-3 py-3 kicker text-text-faint whitespace-nowrap ${h.className}`}>
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
            const isFav = isTeamFavorite(team.team_tricode);

            return (
              <Fragment key={team.id}>
                {showSeparator && (
                  <tr>
                    <td colSpan={HEADERS.length + 3} className="p-0">
                      <div className="h-px bg-accent/40" />
                    </td>
                  </tr>
                )}
                <tr
                  onClick={() => router.push(`/equipes?team=${team.team_tricode}`)}
                  className={`border-b border-rule transition-colors duration-150 hover:bg-card-hover cursor-pointer ${isFav ? "bg-accent-light" : ""}`}
                >
                  <td className={`sticky left-0 z-10 px-2 py-3 ${isFav ? "bg-accent-light" : "bg-card"}`}>
                    <span
                      className={`tnum flex h-6 w-6 items-center justify-center text-xs font-bold ${
                        rank === 1
                          ? "bg-accent text-white"
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
                  <td className="w-6 px-0 py-3 text-center">
                    {getTrendIcon(team.last_10)}
                  </td>
                  <td className={`sticky left-8 z-10 px-2 py-3 ${isFav ? "bg-accent-light" : "bg-card"}`}>
                    <div className="flex items-center gap-2">
                      <img
                        src={teamLogoUrl(team.team_tricode)}
                        alt={team.team_tricode}
                        className="h-6 w-6 object-contain shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className={`font-semibold truncate text-xs sm:text-sm ${isFav ? "text-accent-text" : isPlayoff ? "text-text-primary" : isPlayIn ? "text-text-secondary" : "text-text-muted"}`}>
                          <span className="hidden sm:inline">{team.team_city} {team.team_name}</span>
                          <span className="sm:hidden">{team.team_tricode}</span>
                        </span>
                        {showConference && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
                            {team.conference === "East" ? "Est" : "Ouest"} #{team.conference_rank}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="tnum px-2 sm:px-3 py-3 text-center font-semibold text-text-primary">{team.wins}</td>
                  <td className="tnum px-2 sm:px-3 py-3 text-center text-text-muted">{team.losses}</td>
                  <td className="tnum px-2 sm:px-3 py-3 text-center font-medium text-text-secondary">
                    {(team.win_pct * 100).toFixed(1)}
                  </td>
                  <td className="tnum px-2 sm:px-3 py-3 text-center text-text-muted">
                    {computeGB(leader, team)}
                  </td>
                  <td className="tnum px-2 sm:px-3 py-3 text-center text-text-muted whitespace-nowrap">{team.home_record}</td>
                  <td className="tnum px-2 sm:px-3 py-3 text-center text-text-muted whitespace-nowrap">{team.road_record}</td>
                  <td className="tnum px-2 sm:px-3 py-3 text-center text-text-muted whitespace-nowrap">{team.last_10}</td>
                  <td className="px-2 sm:px-3 py-3 text-center">
                    <span
                      className={`tnum inline-block px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                        team.streak.startsWith("W")
                          ? "text-text-primary"
                          : "text-text-muted"
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

function DivisionsGrid({ allTeams }: { allTeams: Standing[] }) {
  const router = useRouter();
  const { isTeamFavorite } = useFavorites();

  const divisionData = useMemo(() => {
    return Object.entries(DIVISIONS).map(([key, div]) => {
      const teams = div.teams
        .map((tri) => allTeams.find((t) => t.team_tricode === tri))
        .filter(Boolean) as Standing[];
      teams.sort((a, b) => b.win_pct - a.win_pct || b.wins - a.wins);
      return { key, ...div, teams };
    });
  }, [allTeams]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
      {divisionData.map((div) => {
        const leader = div.teams[0];
        return (
          <div key={div.key} className="bg-card border border-rule overflow-hidden transition-colors hover:border-border-hover">
            <div className="px-3 py-2 border-b border-rule flex items-center justify-between">
              <h3 className="font-display text-base text-text-primary">Division {div.name}</h3>
              <span className="kicker text-text-faint">
                {div.conference === "East" ? "Est" : "Ouest"}
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-rule">
                  <th className="px-2 py-1.5 text-left kicker text-text-faint w-6">#</th>
                  <th className="w-5 px-0 py-1.5" />
                  <th className="px-2 py-1.5 text-left kicker text-text-faint">Équipe</th>
                  <th className="px-2 py-1.5 text-center kicker text-text-faint">V</th>
                  <th className="px-2 py-1.5 text-center kicker text-text-faint">D</th>
                  <th className="px-2 py-1.5 text-center kicker text-text-faint">%</th>
                  <th className="px-2 py-1.5 text-center kicker text-text-faint">GB</th>
                </tr>
              </thead>
              <tbody>
                {div.teams.map((team, i) => {
                  const isFav = isTeamFavorite(team.team_tricode);
                  return (
                    <tr
                      key={team.id}
                      onClick={() => router.push(`/equipes?team=${team.team_tricode}`)}
                      className={`border-b border-rule transition-colors duration-150 hover:bg-card-hover cursor-pointer ${isFav ? "bg-accent-light" : ""}`}
                    >
                      <td className="px-2 py-1.5">
                        <span className={`tnum text-xs font-bold ${i === 0 ? "text-accent-text" : "text-text-muted"}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="w-5 px-0 py-1.5 text-center">
                        {getTrendIcon(team.last_10)}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={teamLogoUrl(team.team_tricode)}
                            alt={team.team_tricode}
                            className="h-4 w-4 object-contain shrink-0"
                          />
                          <span className={`font-semibold truncate ${isFav ? "text-accent-text" : "text-text-primary"}`}>
                            <span className="hidden sm:inline">{team.team_city} {team.team_name}</span>
                            <span className="sm:hidden">{team.team_tricode}</span>
                          </span>
                        </div>
                      </td>
                      <td className="tnum px-2 py-1.5 text-center font-semibold text-text-primary">{team.wins}</td>
                      <td className="tnum px-2 py-1.5 text-center text-text-muted">{team.losses}</td>
                      <td className="tnum px-2 py-1.5 text-center font-medium text-text-secondary">
                        {(team.win_pct * 100).toFixed(1)}
                      </td>
                      <td className="tnum px-2 py-1.5 text-center text-text-muted">
                        {leader ? computeGB(leader, team) : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
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
    { key: "divisions", label: "Divisions" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {views.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchView(key)}
            className={`px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest transition-colors duration-200 ${
              view === key
                ? "bg-accent text-white"
                : "border border-rule text-text-muted hover:bg-input hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-rule overflow-hidden">
        <div className="border-b border-rule px-4 sm:px-6 py-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-text-primary sm:text-2xl">
            {view === "east" ? "Conférence Est" : view === "west" ? "Conférence Ouest" : view === "divisions" ? "Classement par division" : "Classement général"}
          </h2>
          <span className="kicker text-text-faint">
            {view === "league" ? "30 équipes" : view === "divisions" ? "6 divisions" : "15 équipes"}
          </span>
        </div>

        {(east.length === 0 && west.length === 0) ? (
          <div className="px-6 py-12 text-center font-mono text-xs uppercase tracking-wider text-text-muted">
            Aucune donnée disponible
          </div>
        ) : view === "divisions" ? (
          <DivisionsGrid allTeams={[...east, ...west]} />
        ) : (
          <>
            <StandingsTable
              teams={view === "east" ? east : view === "west" ? west : leagueTeams}
              showConference={view === "league"}
              scrollRef={tableRef}
            />
            <div className="flex flex-wrap gap-4 sm:gap-6 px-4 sm:px-6 py-3 border-t border-rule">
              <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-text-muted">
                <span className="h-2 w-2 bg-accent" />
                Playoffs (1-6)
              </span>
              <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-text-muted">
                <span className="h-2 w-2 bg-text-secondary" />
                Play-In (7-10)
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
