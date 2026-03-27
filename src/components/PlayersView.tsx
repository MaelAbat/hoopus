"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, ChevronDown } from "lucide-react";
import type { Player } from "@/lib/types/database";
import { teamLogoUrl, playerPhotoUrl, ACTIVE_TEAM_IDS } from "@/lib/nba-teams";

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

const PAGE_SIZE = 60;

export default function PlayersView({ players }: { players: Player[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "retired">("active");
  const [posFilter, setPosFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [page, setPage] = useState(0);

  // Build team list from active players for the dropdown
  const teamOptions = useMemo(() => {
    const tricodes = new Set<string>();
    for (const p of players) {
      if (p.team_tricode && ACTIVE_TEAM_IDS[p.team_tricode]) tricodes.add(p.team_tricode);
    }
    return Array.from(tricodes).sort((a, b) => (TEAM_NAMES[a] || a).localeCompare(TEAM_NAMES[b] || b));
  }, [players]);

  const filtered = useMemo(() => {
    let list = players;

    if (filter === "active") list = list.filter((p) => p.is_active);
    else if (filter === "retired") list = list.filter((p) => !p.is_active);

    if (posFilter) list = list.filter((p) => p.position?.includes(posFilter));

    if (teamFilter) list = list.filter((p) => p.team_tricode === teamFilter);

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          (p.team_tricode && p.team_tricode.toLowerCase().includes(q))
      );
    }

    return list;
  }, [players, search, filter, posFilter, teamFilter]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSearch(v: string) {
    setSearch(v);
    setPage(0);
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher un joueur..."
            className="w-full rounded-xl bg-input border border-border-t pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder-text-faint focus:border-accent/50 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["active", "all", "retired"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === f
                  ? "bg-accent text-white"
                  : "bg-input text-text-muted hover:bg-card-hover hover:text-text-primary"
              }`}
            >
              {f === "active" ? "En activité" : f === "retired" ? "Retraités" : "Tous"}
            </button>
          ))}

          <Dropdown
            value={posFilter}
            onChange={(v) => { setPosFilter(v); setPage(0); }}
            placeholder="Position"
            options={[
              { value: "G", label: "Guard" },
              { value: "F", label: "Forward" },
              { value: "C", label: "Center" },
            ]}
          />

          <Dropdown
            value={teamFilter}
            onChange={(v) => { setTeamFilter(v); setPage(0); }}
            placeholder="Équipe"
            options={teamOptions.map((tri) => ({
              value: tri,
              label: `${tri} — ${TEAM_NAMES[tri] || tri}`,
            }))}
          />
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-text-faint">
        {filtered.length} joueur{filtered.length > 1 ? "s" : ""}
        {filter === "active" ? " en activité" : filter === "retired" ? " retraités" : ""}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {visible.map((p) => (
          <Link
            key={p.player_id}
            href={`/joueurs/${p.player_id}`}
            className="group overflow-hidden rounded-2xl bg-card border border-border-t transition-all duration-200 hover:border-border-hover hover:shadow-lg hover:-translate-y-0.5"
          >
            {/* Photo */}
            <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-accent/10 to-transparent">
              <img
                src={playerPhotoUrl(p.player_id)}
                alt={`${p.first_name} ${p.last_name}`}
                className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = "none";
                }}
              />
              {p.team_tricode && teamLogoUrl(p.team_tricode) && (
                <img
                  src={teamLogoUrl(p.team_tricode)}
                  alt={p.team_tricode}
                  className="absolute bottom-2 right-2 h-6 w-6 object-contain opacity-70"
                />
              )}
              {!p.is_active && (
                <span className="absolute top-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold text-white/70 backdrop-blur-sm">
                  {p.to_year || "Retiré"}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="px-3 py-3">
              <p className="text-xs text-text-muted truncate">{p.first_name}</p>
              <p className="text-sm font-bold text-text-primary truncate">{p.last_name}</p>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-text-faint">
                {p.position && (
                  <span className="rounded bg-input px-1.5 py-0.5 font-semibold text-text-secondary">
                    {p.position}
                  </span>
                )}
                {p.team_tricode && <span>{p.team_tricode}</span>}
              </div>
              {p.pts != null && (
                <div className="mt-2 flex gap-3 text-[10px] text-text-muted">
                  <span><strong className="text-text-secondary">{p.pts.toFixed(1)}</strong> PTS</span>
                  {p.reb != null && <span><strong className="text-text-secondary">{p.reb.toFixed(1)}</strong> REB</span>}
                  {p.ast != null && <span><strong className="text-text-secondary">{p.ast.toFixed(1)}</strong> AST</span>}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="rounded-lg px-3 py-1.5 text-xs font-medium bg-input text-text-muted hover:bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Précédent
          </button>
          <span className="text-xs text-text-muted">
            {page + 1} / {pageCount}
          </span>
          <button
            onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
            disabled={page >= pageCount - 1}
            className="rounded-lg px-3 py-1.5 text-xs font-medium bg-input text-text-muted hover:bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Themed dropdown ─── */

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
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
          value
            ? "bg-accent/10 border-accent/30 text-accent"
            : "bg-input border-border-t text-text-muted hover:text-text-primary"
        }`}
      >
        {selected?.label || placeholder}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-40 mt-1 min-w-[160px] max-h-64 overflow-y-auto rounded-xl bg-card border border-border-t shadow-xl">
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
              !value ? "text-accent font-semibold bg-accent/5" : "text-text-muted hover:bg-card-hover hover:text-text-primary"
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
                  ? "text-accent font-semibold bg-accent/5"
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
