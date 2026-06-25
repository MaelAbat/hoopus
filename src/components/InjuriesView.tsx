"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { teamLogoUrl } from "@/lib/nba-teams";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

interface Injury {
  id: number;
  player_name: string;
  player_position: string | null;
  team: string;
  status: string;
  injury_type: string | null;
  injury_detail: string | null;
  injury_side: string | null;
  return_date: string | null;
  short_comment: string | null;
}

const TEAM_NAMES: Record<string, string> = {
  ATL: "Hawks", BOS: "Celtics", BKN: "Nets", CHA: "Hornets",
  CHI: "Bulls", CLE: "Cavaliers", DAL: "Mavericks", DEN: "Nuggets",
  DET: "Pistons", GSW: "Warriors", HOU: "Rockets", IND: "Pacers",
  LAC: "Clippers", LAL: "Lakers", MEM: "Grizzlies", MIA: "Heat",
  MIL: "Bucks", MIN: "Timberwolves", NOP: "Pelicans", NYK: "Knicks",
  OKC: "Thunder", ORL: "Magic", PHI: "76ers", PHX: "Suns",
  POR: "Trail Blazers", SAC: "Kings", SAS: "Spurs", TOR: "Raptors",
  UTA: "Jazz", WAS: "Wizards",
};

// One accent only — injury status is conveyed through text emphasis, not a
// decorative rainbow. "Out" reads as primary/strong, "Day-To-Day" as muted.
const STATUS_STYLES: Record<string, { text: string; bar: string }> = {
  Out: { text: "text-text-primary", bar: "bg-accent" },
  "Day-To-Day": { text: "text-text-muted", bar: "bg-text-faint" },
};

function formatReturnDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const monthsAway = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsAway > 6) return "Fin de saison";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function injuryLabel(injury: Injury): string {
  const parts: string[] = [];
  if (injury.injury_side) parts.push(injury.injury_side);
  if (injury.injury_type) parts.push(injury.injury_type);
  if (injury.injury_detail) parts.push(`(${injury.injury_detail})`);
  return parts.join(" ") || "Non communiqué";
}

export default function InjuriesView({ injuries }: { injuries: Injury[] }) {
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());

  const teamOptions = useMemo(() => {
    const teams = [...new Set(injuries.map((i) => i.team))];
    return teams.sort((a, b) => (TEAM_NAMES[a] || a).localeCompare(TEAM_NAMES[b] || b));
  }, [injuries]);

  const filtered = useMemo(() => {
    return injuries.filter((i) => {
      if (search && !i.player_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (teamFilter && i.team !== teamFilter) return false;
      if (statusFilter && i.status !== statusFilter) return false;
      return true;
    });
  }, [injuries, search, teamFilter, statusFilter]);

  const groupedByTeam = useMemo(() => {
    const map = new Map<string, Injury[]>();
    for (const i of filtered) {
      const list = map.get(i.team) || [];
      list.push(i);
      map.set(i.team, list);
    }
    const sorted = [...map.entries()].sort((a, b) =>
      (TEAM_NAMES[a[0]] || a[0]).localeCompare(TEAM_NAMES[b[0]] || b[0])
    );
    for (const [, list] of sorted) {
      list.sort((a, b) => {
        if (a.status === "Out" && b.status !== "Out") return -1;
        if (a.status !== "Out" && b.status === "Out") return 1;
        return a.player_name.localeCompare(b.player_name);
      });
    }
    return sorted;
  }, [filtered]);

  const statuses = useMemo(() => [...new Set(injuries.map((i) => i.status))], [injuries]);
  const outCount = filtered.filter((i) => i.status === "Out").length;
  const dtdCount = filtered.filter((i) => i.status === "Day-To-Day").length;

  function toggleTeam(team: string) {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <StatCard value={filtered.length} label="Joueurs blessés" />
        <StatCard value={outCount} label="Indisponibles" accent />
        <StatCard value={dtdCount} label="Day-to-Day" />
        <StatCard value={groupedByTeam.length} label="Équipes touchées" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un joueur..."
            className="w-full bg-input border border-rule pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-faint outline-none focus:border-border-hover transition-colors"
          />
        </div>

        <Dropdown
          value={teamFilter}
          onChange={setTeamFilter}
          placeholder="Équipe"
          options={teamOptions.map((t) => ({
            value: t,
            label: `${t} — ${TEAM_NAMES[t] || t}`,
          }))}
        />

        <Dropdown
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="Statut"
          options={statuses.map((s) => ({ value: s, label: s }))}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="border border-rule bg-card px-6 py-12 text-center text-sm text-text-muted">
          Aucune blessure trouvée
        </div>
      ) : (
        <div className="space-y-2">
          {groupedByTeam.map(([team, list]) => {
            const isCollapsed = collapsedTeams.has(team);
            return (
              <div key={team} className="border border-rule bg-card overflow-hidden">
                {/* Team header */}
                <button
                  onClick={() => toggleTeam(team)}
                  className="flex w-full items-center gap-3 border-b border-rule px-4 py-3 bg-input/50 hover:bg-input transition-colors"
                >
                  <ChevronRight
                    size={14}
                    className={`text-text-faint transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                  />
                  <img src={teamLogoUrl(team)} alt={team} className="h-6 w-6 object-contain" />
                  <span className="font-display text-base text-text-primary">{TEAM_NAMES[team] || team}</span>
                  <span className="tnum font-mono text-[10px] text-text-faint ml-1">
                    {list.length} joueur{list.length > 1 ? "s" : ""}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {list.filter((i) => i.status === "Out").length > 0 && (
                      <span className="tnum border border-rule px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-text-primary">
                        {list.filter((i) => i.status === "Out").length} Out
                      </span>
                    )}
                    {list.filter((i) => i.status === "Day-To-Day").length > 0 && (
                      <span className="tnum border border-rule px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {list.filter((i) => i.status === "Day-To-Day").length} DTD
                      </span>
                    )}
                  </div>
                </button>

                {/* Players */}
                {!isCollapsed && (
                  <div>
                    {/* Column headers */}
                    <div className="flex items-center gap-3 px-4 py-1.5 bg-input/30 border-b border-rule">
                      <span className="flex-1 kicker text-text-faint pl-8">Joueur</span>
                      <span className="w-28 kicker text-text-faint hidden sm:block">Blessure</span>
                      <span className="w-20 kicker text-text-faint hidden sm:block text-right">Retour</span>
                      <span className="w-20 kicker text-text-faint text-right">Statut</span>
                    </div>
                    {list.map((injury) => (
                      <InjuryRow key={injury.id} injury={injury} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Injury row ─── */

function InjuryRow({ injury }: { injury: Injury }) {
  const style = STATUS_STYLES[injury.status] || { text: "text-text-muted", bar: "bg-text-faint" };
  const returnStr = formatReturnDate(injury.return_date);

  return (
    <div className="relative flex items-center gap-3 px-4 py-2.5 border-t border-rule hover:bg-card-hover transition-colors">
      <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${style.bar}`} />
      <div className="flex-1 min-w-0 pl-8">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary truncate">{injury.player_name}</span>
          {injury.player_position && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint shrink-0">{injury.player_position}</span>
          )}
        </div>
        {/* Mobile: injury info under name */}
        <p className="sm:hidden text-[11px] text-text-muted mt-0.5">{injuryLabel(injury)}</p>
      </div>
      <span className="w-28 text-[11px] text-text-muted truncate hidden sm:block">{injuryLabel(injury)}</span>
      <span className="w-20 tnum text-[11px] text-text-faint text-right hidden sm:block">{returnStr || "—"}</span>
      <span className="w-20 text-right shrink-0">
        <span className={`inline-block font-mono text-[10px] font-bold uppercase tracking-wider ${style.text}`}>
          {injury.status}
        </span>
      </span>
    </div>
  );
}

/* ─── Stat card ─── */

function StatCard({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="relative overflow-hidden bg-card border border-rule px-4 py-3 flex-1 min-w-[130px]">
      {accent && <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
      <p className={`tnum font-display text-3xl ${accent ? "text-accent-text" : "text-text-primary"}`}>{value}</p>
      <p className="kicker mt-0.5 text-text-muted">{label}</p>
    </div>
  );
}

/* ─── Themed dropdown (matches PlayersView style) ─── */

interface DropdownProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}

function Dropdown({ value, onChange, placeholder, options }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
          value
            ? "bg-accent-light border-accent text-accent"
            : "bg-input border-rule text-text-muted hover:border-border-hover hover:text-text-primary"
        }`}
      >
        {selected?.label || placeholder}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-40 mt-1 min-w-[160px] max-h-64 overflow-y-auto bg-card border border-rule shadow-xl">
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full text-left px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              !value ? "text-accent font-semibold bg-accent-light" : "text-text-muted hover:bg-card-hover hover:text-text-primary"
            }`}
          >
            {placeholder} (tous)
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                value === opt.value
                  ? "text-accent font-semibold bg-accent-light"
                  : "text-text-primary hover:bg-card-hover"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
