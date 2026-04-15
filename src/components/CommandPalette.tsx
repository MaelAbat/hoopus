"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { teamLogoUrl } from "@/lib/nba-teams";
import { Search } from "lucide-react";
import Image from "next/image";

/* ------------------------------------------------------------------ */
/*  Static team list for client-side filtering                        */
/* ------------------------------------------------------------------ */

interface TeamEntry {
  tricode: string;
  city: string;
  name: string;
}

const NBA_TEAMS: TeamEntry[] = [
  { tricode: "ATL", city: "Atlanta", name: "Hawks" },
  { tricode: "BOS", city: "Boston", name: "Celtics" },
  { tricode: "BKN", city: "Brooklyn", name: "Nets" },
  { tricode: "CHA", city: "Charlotte", name: "Hornets" },
  { tricode: "CHI", city: "Chicago", name: "Bulls" },
  { tricode: "CLE", city: "Cleveland", name: "Cavaliers" },
  { tricode: "DAL", city: "Dallas", name: "Mavericks" },
  { tricode: "DEN", city: "Denver", name: "Nuggets" },
  { tricode: "DET", city: "Detroit", name: "Pistons" },
  { tricode: "GSW", city: "Golden State", name: "Warriors" },
  { tricode: "HOU", city: "Houston", name: "Rockets" },
  { tricode: "IND", city: "Indiana", name: "Pacers" },
  { tricode: "LAC", city: "Los Angeles", name: "Clippers" },
  { tricode: "LAL", city: "Los Angeles", name: "Lakers" },
  { tricode: "MEM", city: "Memphis", name: "Grizzlies" },
  { tricode: "MIA", city: "Miami", name: "Heat" },
  { tricode: "MIL", city: "Milwaukee", name: "Bucks" },
  { tricode: "MIN", city: "Minnesota", name: "Timberwolves" },
  { tricode: "NOP", city: "New Orleans", name: "Pelicans" },
  { tricode: "NYK", city: "New York", name: "Knicks" },
  { tricode: "OKC", city: "Oklahoma City", name: "Thunder" },
  { tricode: "ORL", city: "Orlando", name: "Magic" },
  { tricode: "PHI", city: "Philadelphia", name: "76ers" },
  { tricode: "PHX", city: "Phoenix", name: "Suns" },
  { tricode: "POR", city: "Portland", name: "Trail Blazers" },
  { tricode: "SAC", city: "Sacramento", name: "Kings" },
  { tricode: "SAS", city: "San Antonio", name: "Spurs" },
  { tricode: "TOR", city: "Toronto", name: "Raptors" },
  { tricode: "UTA", city: "Utah", name: "Jazz" },
  { tricode: "WAS", city: "Washington", name: "Wizards" },
];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PlayerResult {
  player_id: number;
  first_name: string;
  last_name: string;
  team_tricode: string;
  position: string;
}

interface ArticleResult {
  id: string;
  title: string;
  tag: string;
}

type ResultItem =
  | { type: "player"; data: PlayerResult }
  | { type: "team"; data: TeamEntry }
  | { type: "article"; data: ArticleResult };

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect platform for shortcut label
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  }, []);

  /* ---- Open / close ---- */
  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  /* ---- Global keyboard shortcut ---- */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          openPalette();
        }
      }
      if (e.key === "Escape" && open) {
        closePalette();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, openPalette, closePalette]);

  /* ---- Focus input when opened ---- */
  useEffect(() => {
    if (open) {
      // Small delay to ensure the DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  /* ---- Search logic (debounced) ---- */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setActiveIndex(0);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const lower = trimmed.toLowerCase();

      // Teams: client-side filter
      const teamResults: ResultItem[] = NBA_TEAMS.filter((t) => {
        const full = `${t.city} ${t.name} ${t.tricode}`.toLowerCase();
        return full.includes(lower);
      })
        .slice(0, 5)
        .map((t) => ({ type: "team" as const, data: t }));

      // Players & articles: Supabase queries in parallel
      const supabase = createClient();

      const [playersRes, articlesRes] = await Promise.all([
        supabase
          .from("players")
          .select("player_id, first_name, last_name, team_tricode, position")
          .or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%`)
          .limit(5),
        supabase
          .from("articles")
          .select("id, title, tag")
          .ilike("title", `%${trimmed}%`)
          .limit(3),
      ]);

      const playerResults: ResultItem[] = (playersRes.data ?? []).map((p) => ({
        type: "player" as const,
        data: p as PlayerResult,
      }));

      const articleResults: ResultItem[] = (articlesRes.data ?? []).map((a) => ({
        type: "article" as const,
        data: a as ArticleResult,
      }));

      setResults([...playerResults, ...teamResults, ...articleResults]);
      setActiveIndex(0);
      setLoading(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  /* ---- Navigation ---- */
  function navigateTo(item: ResultItem) {
    switch (item.type) {
      case "player":
        router.push(`/joueurs/${item.data.player_id}`);
        break;
      case "team":
        router.push(`/equipes?team=${item.data.tricode}`);
        break;
      case "article":
        router.push(`/articles/${item.data.id}`);
        break;
    }
    closePalette();
  }

  /* ---- Keyboard navigation inside results ---- */
  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      navigateTo(results[activeIndex]);
    }
  }

  /* ---- Scroll active item into view ---- */
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  /* ---- Group results by type ---- */
  const grouped = useMemo(() => {
    const players = results.filter((r) => r.type === "player");
    const teams = results.filter((r) => r.type === "team");
    const articles = results.filter((r) => r.type === "article");
    return { players, teams, articles };
  }, [results]);

  // Map each result to its global index for highlighting
  function globalIndex(type: "player" | "team" | "article", localIdx: number): number {
    if (type === "player") return localIdx;
    if (type === "team") return grouped.players.length + localIdx;
    return grouped.players.length + grouped.teams.length + localIdx;
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={closePalette}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" />

      {/* Modal */}
      <div
        className="relative z-10 max-w-lg w-full mx-4 bg-card border border-border-t rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-t">
          <Search size={20} className="shrink-0 text-text-faint" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Rechercher..."
            className="flex-1 bg-transparent text-lg text-text-primary placeholder:text-text-faint outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border-t bg-input px-1.5 py-0.5 text-[10px] font-mono text-text-faint">
            {isMac ? "\u2318" : "Ctrl+"}K
          </kbd>
        </div>

        {/* Results area */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {/* Empty state: no query */}
          {!query.trim() && (
            <p className="px-3 py-8 text-center text-sm text-text-faint">
              Recherchez un joueur, une équipe ou un article...
            </p>
          )}

          {/* Empty state: no results */}
          {query.trim() && !loading && results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-text-faint">
              Aucun résultat pour «&nbsp;{query.trim()}&nbsp;»
            </p>
          )}

          {/* Loading */}
          {query.trim() && loading && results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-text-faint">
              Recherche en cours...
            </p>
          )}

          {/* Players */}
          {grouped.players.length > 0 && (
            <div className="mb-1">
              <p className="text-[10px] uppercase tracking-wider text-text-faint font-semibold px-3 py-1.5">
                Joueurs
              </p>
              {grouped.players.map((item, i) => {
                const idx = globalIndex("player", i);
                const p = item.data as PlayerResult;
                return (
                  <button
                    key={p.player_id}
                    data-active={idx === activeIndex}
                    onClick={() => navigateTo(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-left ${
                      idx === activeIndex ? "bg-input" : "hover:bg-input"
                    }`}
                  >
                    <Image
                      src={`https://cdn.nba.com/headshots/nba/latest/260x190/${p.player_id}.png`}
                      alt={`${p.first_name} ${p.last_name}`}
                      width={20}
                      height={20}
                      className="rounded-full object-cover shrink-0"
                      unoptimized
                    />
                    <span className="flex-1 text-sm text-text-primary truncate">
                      {p.first_name} {p.last_name}
                    </span>
                    <span className="text-xs text-text-faint">{p.team_tricode}</span>
                    <span className="text-xs text-text-faint">{p.position}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Teams */}
          {grouped.teams.length > 0 && (
            <div className="mb-1">
              <p className="text-[10px] uppercase tracking-wider text-text-faint font-semibold px-3 py-1.5">
                Équipes
              </p>
              {grouped.teams.map((item, i) => {
                const idx = globalIndex("team", i);
                const t = item.data as TeamEntry;
                return (
                  <button
                    key={t.tricode}
                    data-active={idx === activeIndex}
                    onClick={() => navigateTo(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-left ${
                      idx === activeIndex ? "bg-input" : "hover:bg-input"
                    }`}
                  >
                    <Image
                      src={teamLogoUrl(t.tricode)}
                      alt={`${t.city} ${t.name}`}
                      width={20}
                      height={20}
                      className="shrink-0 object-contain"
                      unoptimized
                    />
                    <span className="flex-1 text-sm text-text-primary truncate">
                      {t.city} {t.name}
                    </span>
                    <span className="text-xs text-text-faint">{t.tricode}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Articles */}
          {grouped.articles.length > 0 && (
            <div className="mb-1">
              <p className="text-[10px] uppercase tracking-wider text-text-faint font-semibold px-3 py-1.5">
                Articles
              </p>
              {grouped.articles.map((item, i) => {
                const idx = globalIndex("article", i);
                const a = item.data as ArticleResult;
                return (
                  <button
                    key={a.id}
                    data-active={idx === activeIndex}
                    onClick={() => navigateTo(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-left ${
                      idx === activeIndex ? "bg-input" : "hover:bg-input"
                    }`}
                  >
                    {a.tag && (
                      <span className="shrink-0 rounded-md bg-accent-light px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {a.tag}
                      </span>
                    )}
                    <span className="flex-1 text-sm text-text-primary truncate">
                      {a.title}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
