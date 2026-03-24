"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

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

function playerPhotoUrl(playerId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;
}

function draftLabel(p: Player): string {
  if (!p.draft_year || !p.draft_round || !p.draft_number) return "Non drafté";
  return `${p.draft_year} R${p.draft_round} #${p.draft_number}`;
}

/* ─── Team grid ─── */
function TeamGrid({ teams, onSelect }: { teams: { tricode: string; city: string; name: string; count: number }[]; onSelect: (tricode: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {teams.map((t) => (
        <button
          key={t.tricode}
          onClick={() => onSelect(t.tricode)}
          className="group flex flex-col items-center gap-2 rounded-2xl bg-card border border-border-t p-4 transition-all duration-200 hover:border-border-hover hover:shadow-lg"
        >
          <img
            src={teamLogoUrl(t.tricode)}
            alt={t.tricode}
            className="h-12 w-12 object-contain transition-transform duration-200 group-hover:scale-110"
          />
          <div className="text-center">
            <p className="text-xs font-semibold text-text-primary">{t.city}</p>
            <p className="text-xs font-bold text-text-primary">{t.name}</p>
            <p className="text-[10px] text-text-faint mt-0.5">{t.count} joueurs</p>
          </div>
        </button>
      ))}
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
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-input hover:text-text-primary"
        >
          <ChevronLeft size={16} />
          Retour
        </button>
        <img src={teamLogoUrl(tricode)} alt={tricode} className="h-10 w-10 object-contain" />
        <div>
          <h2 className="text-lg font-bold text-text-primary">{team.team_city} {team.team_name}</h2>
          <p className="text-xs text-text-muted">{players.length} joueurs</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border-t text-text-muted">
                <th className="px-3 py-3 text-left font-medium w-12"></th>
                <th className="px-3 py-3 text-left font-medium">Joueur</th>
                <th className="px-3 py-3 text-center font-medium w-10">#</th>
                <th className="px-3 py-3 text-center font-medium w-12">Pos</th>
                <th className="px-3 py-3 text-center font-medium hidden sm:table-cell">Taille</th>
                <th className="px-3 py-3 text-center font-medium hidden sm:table-cell">Poids</th>
                <th className="px-3 py-3 text-center font-medium">Âge</th>
                <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Origine</th>
                <th className="px-3 py-3 text-center font-medium hidden lg:table-cell">Draft</th>
                <th className="px-3 py-3 text-right font-medium hidden md:table-cell">Salaire</th>
                <th className="px-3 py-3 text-center font-medium">PTS</th>
                <th className="px-3 py-3 text-center font-medium hidden sm:table-cell">REB</th>
                <th className="px-3 py-3 text-center font-medium hidden sm:table-cell">AST</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.player_id} className="border-b border-border-t/50 transition-colors hover:bg-card-hover">
                  <td className="px-3 py-2">
                    <img
                      src={playerPhotoUrl(p.player_id)}
                      alt={`${p.first_name} ${p.last_name}`}
                      className="h-8 w-10 object-cover rounded"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/joueurs/${p.player_id}`} className="font-medium text-text-primary hover:text-accent-text transition-colors">
                      {p.first_name} <strong>{p.last_name}</strong>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center text-text-muted">{p.jersey_number}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-block rounded bg-input px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
                      {p.position || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-text-muted hidden sm:table-cell">{p.height || "—"}</td>
                  <td className="px-3 py-2 text-center text-text-muted hidden sm:table-cell">
                    {p.weight ? `${p.weight} lbs` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-text-muted">{p.age ?? "—"}</td>
                  <td className="px-3 py-2 text-text-muted hidden md:table-cell">
                    <div className="flex flex-col">
                      <span className="text-xs">{p.college || "—"}</span>
                      {p.country && p.country !== "USA" && (
                        <span className="text-[10px] text-text-faint">{p.country}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-text-muted text-xs hidden lg:table-cell">{draftLabel(p)}</td>
                  <td className="px-3 py-2 text-right text-xs text-text-muted hidden md:table-cell whitespace-nowrap">
                    {p.salary || "—"}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-text-primary">{p.pts?.toFixed(1) ?? "—"}</td>
                  <td className="px-3 py-2 text-center text-text-muted hidden sm:table-cell">{p.reb?.toFixed(1) ?? "—"}</td>
                  <td className="px-3 py-2 text-center text-text-muted hidden sm:table-cell">{p.ast?.toFixed(1) ?? "—"}</td>
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

  function getStatus(total: number): { label: string; color: string; barBg: string; barFill: string; badgeBg: string } {
    if (total >= CAP_THRESHOLDS.secondApron) return { label: "2nd Apron", color: "text-red-400", barBg: "bg-red-500/30", barFill: "bg-red-500/60", badgeBg: "bg-red-500/10" };
    if (total >= CAP_THRESHOLDS.firstApron) return { label: "1er Apron", color: "text-orange-400", barBg: "bg-orange-500/30", barFill: "bg-orange-500/60", badgeBg: "bg-orange-500/10" };
    if (total >= CAP_THRESHOLDS.luxuryTax) return { label: "Luxury Tax", color: "text-yellow-400", barBg: "bg-yellow-500/30", barFill: "bg-yellow-500/60", badgeBg: "bg-yellow-500/10" };
    if (total >= CAP_THRESHOLDS.salaryCap) return { label: "Over Cap", color: "text-text-secondary", barBg: "bg-accent/30", barFill: "bg-accent/60", badgeBg: "bg-accent/10" };
    return { label: "Under Cap", color: "text-emerald-400", barBg: "bg-emerald-500/30", barFill: "bg-emerald-500/60", badgeBg: "bg-emerald-500/10" };
  }

  const capPct = (CAP_THRESHOLDS.salaryCap / maxTotal) * 100;
  const taxPct = (CAP_THRESHOLDS.luxuryTax / maxTotal) * 100;
  const apron1Pct = (CAP_THRESHOLDS.firstApron / maxTotal) * 100;
  const apron2Pct = (CAP_THRESHOLDS.secondApron / maxTotal) * 100;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="rounded-2xl bg-card border border-border-t p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-emerald-500" />
            <span className="text-text-muted">Salary Cap — {formatMoney(CAP_THRESHOLDS.salaryCap)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-yellow-500" />
            <span className="text-text-muted">Luxury Tax — {formatMoney(CAP_THRESHOLDS.luxuryTax)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-orange-500" />
            <span className="text-text-muted">1er Apron — {formatMoney(CAP_THRESHOLDS.firstApron)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-red-500" />
            <span className="text-text-muted">2nd Apron — {formatMoney(CAP_THRESHOLDS.secondApron)}</span>
          </div>
        </div>
      </div>

      {/* Team bars */}
      <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Threshold headers */}
            <div className="relative h-6 mx-4 mt-3 mb-1">
              <span className="absolute text-[9px] text-emerald-400 font-semibold" style={{ left: `${capPct}%`, transform: "translateX(-50%)" }}>Cap</span>
              <span className="absolute text-[9px] text-yellow-400 font-semibold" style={{ left: `${taxPct}%`, transform: "translateX(-50%)" }}>Tax</span>
              <span className="absolute text-[9px] text-orange-400 font-semibold" style={{ left: `${apron1Pct}%`, transform: "translateX(-50%)" }}>1st</span>
              <span className="absolute text-[9px] text-red-400 font-semibold" style={{ left: `${apron2Pct}%`, transform: "translateX(-50%)" }}>2nd</span>
            </div>

            {teamSalaries.map((team) => {
              const pct = (team.total / maxTotal) * 100;
              const status = getStatus(team.total);

              return (
                <div key={team.tricode} className="flex items-center gap-2 px-4 py-1.5 hover:bg-card-hover transition-colors">
                  {/* Team info */}
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <img src={teamLogoUrl(team.tricode)} alt={team.tricode} className="h-5 w-5 object-contain" />
                    <span className="text-xs font-semibold text-text-primary">{team.tricode}</span>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 relative h-6 bg-input rounded overflow-visible">
                    {/* Threshold lines */}
                    <div className="absolute top-0 bottom-0 w-px bg-emerald-500/40" style={{ left: `${capPct}%` }} />
                    <div className="absolute top-0 bottom-0 w-px bg-yellow-500/40" style={{ left: `${taxPct}%` }} />
                    <div className="absolute top-0 bottom-0 w-px bg-orange-500/40" style={{ left: `${apron1Pct}%` }} />
                    <div className="absolute top-0 bottom-0 w-px bg-red-500/40" style={{ left: `${apron2Pct}%` }} />

                    {/* Fill */}
                    <div
                      className={`absolute top-0.5 bottom-0.5 left-0 rounded ${status.barBg}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    >
                      <div className={`h-full rounded ${status.barFill}`} />
                    </div>
                  </div>

                  {/* Total */}
                  <div className="w-20 shrink-0 text-right">
                    <span className={`text-[11px] font-bold tabular-nums ${status.color}`}>
                      {formatMoney(team.total)}
                    </span>
                  </div>

                  {/* Status badge */}
                  <div className="w-20 shrink-0">
                    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${status.badgeBg} ${status.color}`}>
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
        <div className="rounded-xl bg-card border border-border-t p-3 text-center">
          <p className="text-[10px] text-text-faint uppercase tracking-wider">Over 2nd Apron</p>
          <p className="text-lg font-bold text-red-400">{teamSalaries.filter(t => t.total >= CAP_THRESHOLDS.secondApron).length}</p>
        </div>
        <div className="rounded-xl bg-card border border-border-t p-3 text-center">
          <p className="text-[10px] text-text-faint uppercase tracking-wider">Over 1er Apron</p>
          <p className="text-lg font-bold text-orange-400">{teamSalaries.filter(t => t.total >= CAP_THRESHOLDS.firstApron && t.total < CAP_THRESHOLDS.secondApron).length}</p>
        </div>
        <div className="rounded-xl bg-card border border-border-t p-3 text-center">
          <p className="text-[10px] text-text-faint uppercase tracking-wider">En Luxury Tax</p>
          <p className="text-lg font-bold text-yellow-400">{teamSalaries.filter(t => t.total >= CAP_THRESHOLDS.luxuryTax && t.total < CAP_THRESHOLDS.firstApron).length}</p>
        </div>
        <div className="rounded-xl bg-card border border-border-t p-3 text-center">
          <p className="text-[10px] text-text-faint uppercase tracking-wider">Under Cap</p>
          <p className="text-lg font-bold text-emerald-400">{teamSalaries.filter(t => t.total < CAP_THRESHOLDS.salaryCap).length}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function TeamsView({ players, payrolls }: { players: Player[]; payrolls: TeamPayroll[] }) {
  const [view, setView] = useState<"rosters" | "cap">("rosters");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

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
      <div className="rounded-2xl bg-card border border-border-t px-6 py-12 text-center text-sm text-text-muted">
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

      {view === "cap" ? (
        <SalaryCapView players={players} payrolls={payrolls} />
      ) : (
        <TeamGrid teams={teams} onSelect={setSelectedTeam} />
      )}
    </div>
  );
}
