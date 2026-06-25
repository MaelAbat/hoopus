"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";
import { useFavorites } from "@/context/FavoritesContext";

interface Player {
  id: string;
  player_id: number;
  first_name: string;
  last_name: string;
  team_tricode: string;
  team_name: string;
  team_city: string;
  jersey_number: string;
  position: string;
  height: string;
  weight: string;
  age: number | null;
  college: string;
  country: string;
  draft_year: number | null;
  draft_round: number | null;
  draft_number: number | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  salary: string | null;
}

function draftLabel(p: Player): string {
  if (!p.draft_year || !p.draft_round || !p.draft_number) return "Non drafté";
  return `${p.draft_year} R${p.draft_round} #${p.draft_number}`;
}

/* ─── Team grid ─── */
function TeamGrid({ teams, onSelect }: { teams: { tricode: string; city: string; name: string; count: number }[]; onSelect: (tricode: string) => void }) {
  const { isTeamFavorite } = useFavorites();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {teams.map((t) => {
        const fav = isTeamFavorite(t.tricode);
        return (
          <button
            key={t.tricode}
            onClick={() => onSelect(t.tricode)}
            className={`group relative flex flex-col items-center gap-2 overflow-hidden border bg-card p-4 transition-colors duration-150 ${
              fav ? "border-accent" : "border-rule hover:border-border-hover"
            }`}
          >
            {fav && <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
            <img
              src={teamLogoUrl(t.tricode)}
              alt={t.tricode}
              className="h-12 w-12 object-contain"
            />
            <div className="text-center">
              <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t.city}</p>
              <p className="font-display text-base uppercase leading-none text-text-primary">{t.tricode}</p>
              <p className="kicker mt-1 text-text-faint"><span className="tnum">{t.count}</span> joueurs</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Roster table for a single team ─── */
function RosterTable({ players, tricode, onBack }: { players: Player[]; tricode: string; onBack: () => void }) {
  const team = players[0];
  if (!team) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 border border-rule px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary"
        >
          <ChevronLeft size={16} />
          Retour
        </button>
        <img src={teamLogoUrl(tricode)} alt={tricode} className="h-10 w-10 object-contain" />
        <div>
          <h2 className="font-display text-2xl uppercase leading-none text-text-primary">{team.team_city} {team.team_name}</h2>
          <p className="kicker mt-1 text-text-faint"><span className="tnum">{players.length}</span> joueurs</p>
        </div>
      </div>

      {/* Table */}
      <div className="border border-rule bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-rule">
                <th className="sticky left-0 z-20 bg-card px-2 sm:px-3 py-3 text-left kicker text-text-faint min-w-[100px] sm:min-w-[160px]">Joueur</th>
                <th className="px-2 py-3 text-center kicker text-text-faint">#</th>
                <th className="px-2 py-3 text-center kicker text-text-faint">Pos</th>
                <th className="px-2 py-3 text-center kicker text-text-faint whitespace-nowrap">Taille</th>
                <th className="px-2 py-3 text-center kicker text-text-faint whitespace-nowrap">Poids</th>
                <th className="px-2 py-3 text-center kicker text-text-faint">Age</th>
                <th className="px-2 py-3 text-left kicker text-text-faint whitespace-nowrap">Origine</th>
                <th className="px-2 py-3 text-center kicker text-text-faint whitespace-nowrap">Draft</th>
                <th className="px-2 py-3 text-right kicker text-text-faint whitespace-nowrap">Salaire</th>
                <th className="px-2 py-3 text-center kicker text-text-faint">PTS</th>
                <th className="px-2 py-3 text-center kicker text-text-faint">REB</th>
                <th className="px-2 py-3 text-center kicker text-text-faint">AST</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.player_id} className="group border-b border-rule transition-colors hover:bg-card-hover">
                  <td className="sticky left-0 z-10 bg-card group-hover:bg-card-hover px-2 sm:px-3 py-1.5 sm:py-2">
                    <Link href={`/joueurs/${p.player_id}`} className="flex items-center gap-1.5 sm:gap-2 font-medium text-text-primary hover:text-accent-text transition-colors whitespace-nowrap">
                      <img
                        src={playerPhotoUrl(p.player_id)}
                        alt=""
                        className="h-6 w-6 sm:h-8 sm:w-8 shrink-0 object-cover bg-input"
                        onError={(e) => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).className = "h-6 w-6 sm:h-8 sm:w-8 shrink-0 bg-input"; }}
                      />
                      <span className="text-xs sm:text-sm">{p.first_name.charAt(0)}. <strong>{p.last_name}</strong></span>
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center tnum text-text-muted">{p.jersey_number}</td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block border border-rule px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                      {p.position || "N/A"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center tnum text-text-muted whitespace-nowrap">{p.height || "N/A"}</td>
                  <td className="px-2 py-2 text-center tnum text-text-muted whitespace-nowrap">
                    {p.weight ? `${p.weight} lbs` : "N/A"}
                  </td>
                  <td className="px-2 py-2 text-center tnum text-text-muted">{p.age ?? "N/A"}</td>
                  <td className="px-2 py-2 text-text-muted">
                    <div className="flex flex-col whitespace-nowrap">
                      <span className="text-xs">{p.college || "N/A"}</span>
                      {p.country && p.country !== "USA" && (
                        <span className="text-[10px] text-text-faint">{p.country}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center tnum text-text-muted text-xs whitespace-nowrap">{draftLabel(p)}</td>
                  <td className="px-2 py-2 text-right tnum text-xs text-text-muted whitespace-nowrap">
                    {p.salary || "N/A"}
                  </td>
                  <td className="px-2 py-2 text-center tnum font-semibold text-text-primary">{p.pts?.toFixed(1) ?? "N/A"}</td>
                  <td className="px-2 py-2 text-center tnum text-text-muted">{p.reb?.toFixed(1) ?? "N/A"}</td>
                  <td className="px-2 py-2 text-center tnum text-text-muted">{p.ast?.toFixed(1) ?? "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Salary Cap thresholds 2025-26 ─── */
const CAP_THRESHOLDS = {
  salaryCap: 154_647_000,
  luxuryTax: 188_931_000,
  firstApron: 196_581_000,
  secondApron: 204_231_000,
};

function parseSalary(salary: string | null): number {
  if (!salary) return 0;
  return Number(salary.replace(/[$,]/g, "")) || 0;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

interface TeamPayroll {
  team_tricode: string;
  payroll: number;
}

/* ─── Salary Cap view ─── */
function SalaryCapView({ players, payrolls }: { players: Player[]; payrolls: TeamPayroll[] }) {
  const teamSalaries = useMemo(() => {
    // Build team info from players
    const teamInfo = new Map<string, { city: string; name: string }>();
    for (const p of players) {
      if (!teamInfo.has(p.team_tricode)) {
        teamInfo.set(p.team_tricode, { city: p.team_city, name: p.team_name });
      }
    }

    // Use scraped payroll totals from BR (accurate with dead money, cap holds)
    if (payrolls.length > 0) {
      return payrolls
        .map(p => ({
          tricode: p.team_tricode,
          city: teamInfo.get(p.team_tricode)?.city || p.team_tricode,
          name: teamInfo.get(p.team_tricode)?.name || "",
          total: p.payroll,
        }))
        .sort((a, b) => b.total - a.total);
    }

    // Fallback: compute from individual salaries
    const map = new Map<string, { tricode: string; city: string; name: string; total: number }>();
    for (const p of players) {
      if (!map.has(p.team_tricode)) {
        map.set(p.team_tricode, { tricode: p.team_tricode, city: p.team_city, name: p.team_name, total: 0 });
      }
      map.get(p.team_tricode)!.total += parseSalary(p.salary);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [players, payrolls]);

  const maxTotal = Math.max(...teamSalaries.map(t => t.total), CAP_THRESHOLDS.secondApron * 1.1);

  function getStatus(total: number): { label: string; color: string; barFill: string; badge: string } {
    if (total >= CAP_THRESHOLDS.secondApron) return { label: "2nd Apron", color: "text-red-500", barFill: "bg-red-500", badge: "border-red-500 text-red-500" };
    if (total >= CAP_THRESHOLDS.firstApron) return { label: "1er Apron", color: "text-accent-text", barFill: "bg-accent", badge: "border-accent text-accent-text" };
    if (total >= CAP_THRESHOLDS.luxuryTax) return { label: "Luxury Tax", color: "text-text-primary", barFill: "bg-accent/70", badge: "border-rule text-text-primary" };
    if (total >= CAP_THRESHOLDS.salaryCap) return { label: "Over Cap", color: "text-text-secondary", barFill: "bg-text-muted", badge: "border-rule text-text-secondary" };
    return { label: "Under Cap", color: "text-text-muted", barFill: "bg-text-faint", badge: "border-rule text-text-muted" };
  }

  const capPct = (CAP_THRESHOLDS.salaryCap / maxTotal) * 100;
  const taxPct = (CAP_THRESHOLDS.luxuryTax / maxTotal) * 100;
  const apron1Pct = (CAP_THRESHOLDS.firstApron / maxTotal) * 100;
  const apron2Pct = (CAP_THRESHOLDS.secondApron / maxTotal) * 100;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="border border-rule bg-card p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {[
            { label: "Salary Cap", val: CAP_THRESHOLDS.salaryCap },
            { label: "Luxury Tax", val: CAP_THRESHOLDS.luxuryTax },
            { label: "1er Apron", val: CAP_THRESHOLDS.firstApron },
            { label: "2nd Apron", val: CAP_THRESHOLDS.secondApron },
          ].map((item) => (
            <div key={item.label} className="flex items-baseline gap-2">
              <span className="kicker text-text-faint">{item.label}</span>
              <span className="tnum text-xs font-semibold text-text-primary">{formatMoney(item.val)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Team bars */}
      <div className="border border-rule bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Threshold headers */}
            <div className="relative h-6 mx-4 mt-3 mb-1">
              <span className="absolute kicker text-text-faint" style={{ left: `${capPct}%`, transform: "translateX(-50%)" }}>Cap</span>
              <span className="absolute kicker text-text-faint" style={{ left: `${taxPct}%`, transform: "translateX(-50%)" }}>Tax</span>
              <span className="absolute kicker text-text-faint" style={{ left: `${apron1Pct}%`, transform: "translateX(-50%)" }}>1st</span>
              <span className="absolute kicker text-accent-text" style={{ left: `${apron2Pct}%`, transform: "translateX(-50%)" }}>2nd</span>
            </div>

            {teamSalaries.map((team) => {
              const pct = (team.total / maxTotal) * 100;
              const status = getStatus(team.total);

              return (
                <div key={team.tricode} className="group flex items-center gap-2 pr-4 border-t border-rule hover:bg-card-hover transition-colors">
                  {/* Team info */}
                  <div className="sticky left-0 z-10 flex items-center gap-2 w-28 shrink-0 pl-4 py-1.5 bg-card group-hover:bg-card-hover transition-colors">
                    <img src={teamLogoUrl(team.tricode)} alt={team.tricode} className="h-5 w-5 object-contain" />
                    <span className="font-display text-sm uppercase text-text-primary">{team.tricode}</span>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 relative h-6 bg-input overflow-visible">
                    {/* Threshold lines */}
                    <div className="absolute top-0 bottom-0 w-px bg-border-hover" style={{ left: `${capPct}%` }} />
                    <div className="absolute top-0 bottom-0 w-px bg-border-hover" style={{ left: `${taxPct}%` }} />
                    <div className="absolute top-0 bottom-0 w-px bg-border-hover" style={{ left: `${apron1Pct}%` }} />
                    <div className="absolute top-0 bottom-0 w-px bg-accent" style={{ left: `${apron2Pct}%` }} />

                    {/* Fill */}
                    <div
                      className={`absolute top-0.5 bottom-0.5 left-0 ${status.barFill}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  {/* Total */}
                  <div className="w-20 shrink-0 text-right">
                    <span className={`tnum text-[11px] font-bold ${status.color}`}>
                      {formatMoney(team.total)}
                    </span>
                  </div>

                  {/* Status badge */}
                  <div className="w-20 shrink-0">
                    <span className={`inline-block border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${status.badge}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-rule bg-card p-3 text-center">
          <p className="kicker text-text-faint">Over 2nd Apron</p>
          <p className="font-display text-2xl tnum text-text-primary">{teamSalaries.filter(t => t.total >= CAP_THRESHOLDS.secondApron).length}</p>
        </div>
        <div className="border border-rule bg-card p-3 text-center">
          <p className="kicker text-text-faint">Over 1er Apron</p>
          <p className="font-display text-2xl tnum text-text-primary">{teamSalaries.filter(t => t.total >= CAP_THRESHOLDS.firstApron && t.total < CAP_THRESHOLDS.secondApron).length}</p>
        </div>
        <div className="border border-rule bg-card p-3 text-center">
          <p className="kicker text-text-faint">En Luxury Tax</p>
          <p className="font-display text-2xl tnum text-text-primary">{teamSalaries.filter(t => t.total >= CAP_THRESHOLDS.luxuryTax && t.total < CAP_THRESHOLDS.firstApron).length}</p>
        </div>
        <div className="border border-rule bg-card p-3 text-center">
          <p className="kicker text-text-faint">Under Cap</p>
          <p className="font-display text-2xl tnum text-text-primary">{teamSalaries.filter(t => t.total < CAP_THRESHOLDS.salaryCap).length}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function TeamsView({ players, payrolls }: { players: Player[]; payrolls: TeamPayroll[] }) {
  const [view, setView] = useState<"rosters" | "cap">("rosters");
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [selectedTeam, setSelectedTeam] = useState<string | null>(searchParams?.get("team") || null);

  const views: { key: "rosters" | "cap"; label: string }[] = [
    { key: "rosters", label: "Effectifs" },
    { key: "cap", label: "Masse salariale" },
  ];

  const teams = useMemo(() => {
    const map = new Map<string, { tricode: string; city: string; name: string; count: number }>();
    for (const p of players) {
      if (!map.has(p.team_tricode)) {
        map.set(p.team_tricode, {
          tricode: p.team_tricode,
          city: p.team_city,
          name: p.team_name,
          count: 0,
        });
      }
      map.get(p.team_tricode)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => a.city.localeCompare(b.city));
  }, [players]);

  const teamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return players
      .filter((p) => p.team_tricode === selectedTeam)
      .sort((a, b) => {
        const posOrder: Record<string, number> = { G: 1, "G-F": 2, F: 3, "F-G": 2, "F-C": 4, C: 5 };
        const pa = posOrder[a.position] || 3;
        const pb = posOrder[b.position] || 3;
        if (pa !== pb) return pa - pb;
        return (b.pts ?? 0) - (a.pts ?? 0);
      });
  }, [players, selectedTeam]);

  if (players.length === 0) {
    return (
      <div className="border border-rule bg-card px-6 py-12 text-center text-sm text-text-muted">
        Aucune donnée disponible — synchronisez les effectifs d&apos;abord.
      </div>
    );
  }

  if (selectedTeam) {
    return <RosterTable players={teamPlayers} tricode={selectedTeam} onBack={() => { setSelectedTeam(null); }} />;
  }

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex gap-2">
        {views.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`border px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest transition-colors ${
              view === key
                ? "border-accent bg-accent text-white"
                : "border-rule text-text-muted hover:border-border-hover hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "cap" ? (
        <SalaryCapView players={players} payrolls={payrolls} />
      ) : (
        <TeamGrid teams={teams} onSelect={setSelectedTeam} />
      )}
    </div>
  );
}
