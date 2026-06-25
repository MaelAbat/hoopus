"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { teamLogoUrl } from "@/lib/nba-teams";
import type { CompareData } from "@/app/joueurs/comparer/page";

/* ─── Player colors ─── */
const PLAYER_COLORS = ["#f97316", "#3b82f6", "#10b981"];
const PLAYER_BG = ["rgba(249,115,22,0.15)", "rgba(59,130,246,0.15)", "rgba(16,185,129,0.15)"];

/* ─── Stat keys for radar + bars ─── */
const STAT_KEYS = ["pts", "reb", "ast", "stl", "blk", "fg_pct"] as const;
const STAT_LABELS: Record<string, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  fg_pct: "FG%",
};
const STAT_LABELS_FR: Record<string, string> = {
  pts: "Points",
  reb: "Rebonds",
  ast: "Passes",
  stl: "Interceptions",
  blk: "Contres",
  fg_pct: "Tir (%)",
};

/* ─── Types ─── */
interface SearchResult {
  player_id: number;
  first_name: string;
  last_name: string;
  team_tricode: string | null;
  position: string | null;
}

/* ─── Radar Chart ─── */
function RadarChart({
  players,
  stats,
}: {
  players: CompareData[];
  stats: Record<number, Record<string, number>>;
}) {
  const n = STAT_KEYS.length;
  const angleStep = (2 * Math.PI) / n;
  const cx = 150;
  const cy = 150;
  const maxR = 110;

  // Compute max values for normalization
  const maxVals: Record<string, number> = {};
  for (const key of STAT_KEYS) {
    maxVals[key] = Math.max(1, ...players.map((p) => stats[p.player.player_id]?.[key] ?? 0));
  }

  function getPoint(i: number, value: number, max: number): [number, number] {
    const angle = angleStep * i - Math.PI / 2;
    const r = (value / max) * maxR;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  function guidePolygon(pct: number) {
    return STAT_KEYS.map((_, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const r = pct * maxR;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");
  }

  function playerPolygon(playerId: number) {
    return STAT_KEYS.map((key, i) => {
      const val = stats[playerId]?.[key] ?? 0;
      const [x, y] = getPoint(i, val, maxVals[key]);
      return `${x},${y}`;
    }).join(" ");
  }

  const labelOffsets = STAT_KEYS.map((_, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const r = maxR + 20;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  return (
    <div className="flex justify-center">
      <svg
        viewBox="0 0 300 300"
        className="h-[250px] w-[250px] sm:h-[300px] sm:w-[300px]"
      >
        {/* Guide circles */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <polygon
            key={pct}
            points={guidePolygon(pct)}
            fill="none"
            stroke="currentColor"
            className="text-rule"
            strokeWidth={0.5}
            opacity={0.5}
          />
        ))}

        {/* Axes */}
        {STAT_KEYS.map((_, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const x2 = cx + maxR * Math.cos(angle);
          const y2 = cy + maxR * Math.sin(angle);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              className="text-rule"
              strokeWidth={0.5}
              opacity={0.3}
            />
          );
        })}

        {/* Player polygons */}
        {players.map((p, idx) => (
          <polygon
            key={p.player.player_id}
            points={playerPolygon(p.player.player_id)}
            fill={PLAYER_COLORS[idx]}
            fillOpacity={0.15}
            stroke={PLAYER_COLORS[idx]}
            strokeWidth={2}
          />
        ))}

        {/* Player dots */}
        {players.map((p, idx) =>
          STAT_KEYS.map((key, i) => {
            const val = stats[p.player.player_id]?.[key] ?? 0;
            const [x, y] = getPoint(i, val, maxVals[key]);
            return (
              <circle
                key={`${p.player.player_id}-${key}`}
                cx={x}
                cy={y}
                r={3}
                fill={PLAYER_COLORS[idx]}
              />
            );
          })
        )}

        {/* Labels */}
        {STAT_KEYS.map((key, i) => (
          <text
            key={key}
            x={labelOffsets[i].x}
            y={labelOffsets[i].y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-text-faint font-mono text-[10px] font-semibold uppercase tracking-wider"
          >
            {STAT_LABELS[key]}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ─── Stat Bars ─── */
function StatBars({
  players,
  stats,
}: {
  players: CompareData[];
  stats: Record<number, Record<string, number>>;
}) {
  return (
    <div className="divide-y divide-rule">
      {STAT_KEYS.map((key) => {
        const values = players.map((p) => stats[p.player.player_id]?.[key] ?? 0);
        const max = Math.max(1, ...values);
        const best = Math.max(...values);
        return (
          <div key={key} className="py-4 first:pt-0 last:pb-0">
            <p className="kicker mb-2.5 text-text-faint">
              {STAT_LABELS_FR[key]}
            </p>
            <div className="space-y-1.5">
              {players.map((p, idx) => {
                const val = stats[p.player.player_id]?.[key] ?? 0;
                const pct = (val / max) * 100;
                const isBest = val > 0 && val === best;
                const display = key === "fg_pct" ? `${(val * 100).toFixed(1)}%` : val.toFixed(1);
                return (
                  <div key={p.player.player_id} className="flex items-center gap-3">
                    <span className={`w-24 truncate text-xs uppercase tracking-wide sm:w-32 ${isBest ? "font-bold text-text-primary" : "font-medium text-text-muted"}`}>
                      {p.player.last_name}
                    </span>
                    <div className="flex-1 h-4 bg-input overflow-hidden">
                      <div
                        className="h-full transition-all duration-700 ease-out"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: PLAYER_COLORS[idx],
                          opacity: isBest ? 1 : 0.55,
                        }}
                      />
                    </div>
                    <span className={`tnum w-14 text-right text-sm ${isBest ? "font-bold text-text-primary" : "font-semibold text-text-muted"}`}>
                      {display}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Career Stats Table ─── */
function CareerTable({ players }: { players: CompareData[] }) {
  // Get the latest season for each player
  const latestSeasons = players.map((p) => {
    if (p.career.length === 0) return null;
    return p.career[p.career.length - 1];
  });

  const hasData = latestSeasons.some((s) => s !== null);
  if (!hasData) return null;

  const columns = [
    { key: "season", label: "Saison" },
    { key: "team", label: "Équipe" },
    { key: "gp", label: "MJ" },
    { key: "min", label: "MIN" },
    { key: "pts", label: "PTS" },
    { key: "reb", label: "REB" },
    { key: "ast", label: "AST" },
    { key: "stl", label: "STL" },
    { key: "blk", label: "BLK" },
    { key: "fg_pct", label: "FG%" },
    { key: "fg3_pct", label: "3P%" },
    { key: "ft_pct", label: "FT%" },
  ] as const;

  // Best value per numeric column, to highlight the leader on each stat row.
  const numericKeys = ["gp", "min", "pts", "reb", "ast", "stl", "blk", "fg_pct", "fg3_pct", "ft_pct"] as const;
  const bests: Record<string, number> = {};
  for (const k of numericKeys) {
    bests[k] = Math.max(
      0,
      ...latestSeasons.map((s) => (s ? Number(s[k]) : Number.NEGATIVE_INFINITY))
    );
  }
  const cell = (key: string, value: number, text: string) => {
    const isBest = value > 0 && value === bests[key];
    return (
      <td
        key={key}
        className={`tnum px-3 py-2.5 text-right whitespace-nowrap ${isBest ? "bg-accent-light font-bold text-text-primary" : "text-text-muted"}`}
      >
        {text}
      </td>
    );
  };

  return (
    <div className="overflow-x-auto border border-rule bg-card">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-rule">
            <th className="kicker sticky left-0 bg-card px-4 py-3 text-left text-text-faint">
              Joueur
            </th>
            {columns.map((col) => (
              <th key={col.key} className="kicker px-3 py-3 text-right text-text-faint whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {players.map((p, idx) => {
            const s = latestSeasons[idx];
            return (
              <tr
                key={p.player.player_id}
                className="transition-colors hover:bg-card-hover"
              >
                <td className="sticky left-0 bg-card px-4 py-2.5 font-semibold uppercase tracking-wide text-text-primary whitespace-nowrap">
                  <span className="inline-block h-2 w-2 mr-2" style={{ backgroundColor: PLAYER_COLORS[idx] }} />
                  {p.player.first_name} {p.player.last_name}
                </td>
                {s ? (
                  <>
                    <td className="tnum px-3 py-2.5 text-right text-text-muted whitespace-nowrap">{s.season}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[11px] uppercase tracking-wider text-text-muted whitespace-nowrap">{s.team}</td>
                    {cell("gp", Number(s.gp), String(s.gp))}
                    {cell("min", Number(s.min), Number(s.min).toFixed(1))}
                    {cell("pts", Number(s.pts), Number(s.pts).toFixed(1))}
                    {cell("reb", Number(s.reb), Number(s.reb).toFixed(1))}
                    {cell("ast", Number(s.ast), Number(s.ast).toFixed(1))}
                    {cell("stl", Number(s.stl), Number(s.stl).toFixed(1))}
                    {cell("blk", Number(s.blk), Number(s.blk).toFixed(1))}
                    {cell("fg_pct", Number(s.fg_pct), (Number(s.fg_pct) * 100).toFixed(1))}
                    {cell("fg3_pct", Number(s.fg3_pct), (Number(s.fg3_pct) * 100).toFixed(1))}
                    {cell("ft_pct", Number(s.ft_pct), (Number(s.ft_pct) * 100).toFixed(1))}
                  </>
                ) : (
                  <td colSpan={columns.length} className="px-3 py-2.5 text-center text-text-faint">
                    Aucune donnée disponible
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main Component ─── */
export default function PlayerCompare({ initialData }: { initialData: CompareData[] }) {
  const router = useRouter();
  const [players, setPlayers] = useState<CompareData[]>(initialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = useMemo(() => new Set(players.map((p) => p.player.player_id)), [players]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("players")
        .select("player_id, first_name, last_name, team_tricode, position")
        .eq("is_active", true)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .order("last_name")
        .limit(10);
      setSearchResults(data ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  function updateUrl(newPlayers: CompareData[]) {
    const params = new URLSearchParams();
    newPlayers.forEach((p, i) => {
      params.set(`p${i + 1}`, String(p.player.player_id));
    });
    router.push(`/joueurs/comparer?${params.toString()}`);
  }

  async function addPlayer(result: SearchResult) {
    if (players.length >= 3 || selectedIds.has(result.player_id)) return;

    // Fetch full data for this player
    const supabase = createClient();
    const [{ data: player }, { data: career }] = await Promise.all([
      supabase
        .from("players")
        .select("player_id, first_name, last_name, position, team_tricode, height, weight, country, pts, reb, ast")
        .eq("player_id", result.player_id)
        .single(),
      supabase
        .from("player_career_stats")
        .select("player_id, season, team, gp, pts, reb, ast, stl, blk, fg_pct, fg3_pct, ft_pct, min, ts_pct, efg_pct")
        .eq("player_id", result.player_id)
        .order("season", { ascending: true }),
    ]);

    if (!player) return;

    const newPlayers = [...players, { player, career: career ?? [] }];
    setPlayers(newPlayers);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
    updateUrl(newPlayers);
  }

  function removePlayer(id: number) {
    const newPlayers = players.filter((p) => p.player.player_id !== id);
    setPlayers(newPlayers);
    if (newPlayers.length === 0) {
      router.push("/joueurs/comparer");
    } else {
      updateUrl(newPlayers);
    }
  }

  // Compute latest-season stats for radar + bars
  const latestStats = useMemo(() => {
    const result: Record<number, Record<string, number>> = {};
    for (const p of players) {
      const latest = p.career.length > 0 ? p.career[p.career.length - 1] : null;
      result[p.player.player_id] = {
        pts: latest ? Number(latest.pts) : (p.player.pts ?? 0),
        reb: latest ? Number(latest.reb) : (p.player.reb ?? 0),
        ast: latest ? Number(latest.ast) : (p.player.ast ?? 0),
        stl: latest ? Number(latest.stl) : 0,
        blk: latest ? Number(latest.blk) : 0,
        fg_pct: latest ? Number(latest.fg_pct) : 0,
      };
    }
    return result;
  }, [players]);

  const canCompare = players.length >= 2;

  return (
    <div className="space-y-8">
      {/* Player selector */}
      <div className="border border-rule bg-card p-6 sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl text-text-primary sm:text-3xl">
            Sélectionner des joueurs
          </h2>
          <span className="tnum font-mono text-[11px] font-semibold uppercase tracking-wider text-text-faint">
            {players.length}/3 joueurs
          </span>
        </div>

        {/* Selected players */}
        <div className="mb-4 flex flex-wrap gap-3">
          {players.map((p, idx) => (
            <div
              key={p.player.player_id}
              className="relative flex items-center gap-2 border border-rule bg-card px-3 py-2 text-sm font-semibold uppercase tracking-wide text-text-primary"
            >
              <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: PLAYER_COLORS[idx] }} />
              {p.player.team_tricode && teamLogoUrl(p.player.team_tricode) && (
                <img
                  src={teamLogoUrl(p.player.team_tricode)}
                  alt={p.player.team_tricode}
                  className="h-5 w-5 object-contain"
                />
              )}
              {p.player.first_name} {p.player.last_name}
              <button
                onClick={() => removePlayer(p.player.player_id)}
                className="ml-1 p-0.5 text-text-muted transition-colors hover:bg-input hover:text-text-primary"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {players.length < 3 && (
            <div ref={searchRef} className="relative">
              <button
                onClick={() => {
                  setShowSearch(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="flex items-center gap-2 border border-dashed border-border-hover bg-input px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:border-accent hover:text-text-primary"
              >
                <Plus size={14} />
                Ajouter un joueur
              </button>

              {showSearch && (
                <div className="absolute left-0 top-full z-50 mt-2 w-72 border border-rule bg-card shadow-xl">
                  <div className="relative p-2">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Rechercher un joueur..."
                      className="w-full bg-input border border-rule pl-8 pr-3 py-2 text-sm text-text-primary placeholder-text-faint focus:border-border-hover focus:outline-none transition-colors"
                    />
                  </div>

                  {isSearching && (
                    <p className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-text-faint">Recherche en cours...</p>
                  )}

                  {!isSearching && searchResults.length > 0 && (
                    <div className="max-h-64 overflow-y-auto border-t border-rule">
                      {searchResults.map((r) => {
                        const alreadySelected = selectedIds.has(r.player_id);
                        return (
                          <button
                            key={r.player_id}
                            onClick={() => !alreadySelected && addPlayer(r)}
                            disabled={alreadySelected}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              alreadySelected
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:bg-card-hover"
                            }`}
                          >
                            {r.team_tricode && teamLogoUrl(r.team_tricode) && (
                              <img
                                src={teamLogoUrl(r.team_tricode)}
                                alt={r.team_tricode}
                                className="h-5 w-5 object-contain"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold uppercase tracking-wide text-text-primary truncate">
                                {r.first_name} {r.last_name}
                              </p>
                              <p className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
                                {r.position} {r.team_tricode ? `· ${r.team_tricode}` : ""}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                    <p className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-text-faint">Aucun joueur trouvé</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!canCompare && (
          <p className="font-mono text-[11px] uppercase tracking-wider text-text-faint">
            Sélectionnez au moins 2 joueurs pour lancer la comparaison.
          </p>
        )}
      </div>

      {/* Comparison content */}
      {canCompare && (
        <>
          {/* Player cards */}
          <div className={`grid gap-4 ${players.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
            {players.map((p, idx) => (
              <div
                key={p.player.player_id}
                className="group relative overflow-hidden border border-rule bg-card transition-colors hover:border-border-hover"
              >
                <span
                  className="absolute left-0 top-0 bottom-0 z-10 w-1"
                  style={{ backgroundColor: PLAYER_COLORS[idx] }}
                />
                <div className="flex items-center gap-4 p-5">
                  <div className="relative h-20 w-24 shrink-0 overflow-hidden bg-input">
                    <img
                      src={`https://cdn.nba.com/headshots/nba/latest/260x190/${p.player.player_id}.png`}
                      alt={`${p.player.first_name} ${p.player.last_name}`}
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="kicker text-text-faint">{p.player.first_name}</p>
                    <p className="font-display text-2xl text-text-primary truncate">{p.player.last_name}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      {p.player.team_tricode && teamLogoUrl(p.player.team_tricode) && (
                        <img
                          src={teamLogoUrl(p.player.team_tricode)}
                          alt={p.player.team_tricode}
                          className="h-5 w-5 object-contain"
                        />
                      )}
                      {p.player.position && (
                        <span className="border border-rule px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                          {p.player.position}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Radar Chart */}
          <div className="border border-rule bg-card p-6 sm:p-8">
            <p className="kicker mb-5 text-text-faint">Vue d&apos;ensemble</p>
            <RadarChart players={players} stats={latestStats} />
            {/* Legend */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
              {players.map((p, idx) => (
                <div key={p.player.player_id} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3"
                    style={{ backgroundColor: PLAYER_COLORS[idx] }}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-primary">
                    {p.player.first_name} {p.player.last_name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stat Bars */}
          <div className="border border-rule bg-card p-6 sm:p-8">
            <p className="kicker mb-5 text-text-faint">Comparaison détaillée</p>
            <StatBars players={players} stats={latestStats} />
          </div>

          {/* Career Table */}
          <div>
            <div className="mb-5 flex items-baseline gap-3">
              <h3 className="font-display text-2xl text-text-primary sm:text-3xl">
                Statistiques de la dernière saison
              </h3>
            </div>
            <CareerTable players={players} />
          </div>
        </>
      )}

      {/* Empty state */}
      {!canCompare && players.length === 0 && (
        <div className="flex flex-col items-center justify-center border border-dashed border-rule bg-card py-16">
          <Users size={48} className="mb-4 text-text-faint" />
          <p className="font-display text-2xl text-text-primary sm:text-3xl">
            Comparez vos joueurs préférés
          </p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-text-muted">
            Ajoutez 2 ou 3 joueurs pour découvrir leurs statistiques côte à côte.
          </p>
        </div>
      )}
    </div>
  );
}
