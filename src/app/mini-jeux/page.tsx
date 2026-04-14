"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import Link from "next/link";
import { Target, Image, Brain, Grid3X3, Sparkles, Trophy, Clock, ArrowRight, Flame, BarChart3, Link2, Check, X } from "lucide-react";
import { ReactNode } from "react";

/* ─── Miniature previews for each game ─── */

function PreviewHoopl() {
  const cols = ["EQ", "CONF", "DIV", "POS", "PTS", "REB"];
  return (
    <div className="flex items-center justify-center gap-1">
      {cols.map((c, i) => (
        <div key={c} className={`flex h-7 w-9 items-center justify-center rounded text-[7px] font-bold ${i < 3 ? "bg-emerald-500/30 text-emerald-300" : i < 5 ? "bg-amber-500/30 text-amber-300" : "bg-red-500/30 text-red-300"}`}>
          {c}
        </div>
      ))}
    </div>
  );
}

function PreviewHoopixl() {
  return (
    <div className="flex items-center justify-center">
      <div className="grid grid-cols-5 grid-rows-5 gap-px">
        {Array.from({ length: 25 }).map((_, i) => {
          const center = [6, 7, 8, 11, 12, 13, 16, 17, 18];
          const mid = [1, 2, 3, 5, 9, 10, 14, 15, 19, 21, 22, 23];
          return (
            <div
              key={i}
              className={`h-3 w-3 rounded-sm ${center.includes(i) ? "bg-violet-400/60" : mid.includes(i) ? "bg-violet-400/25" : "bg-violet-400/10"}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function PreviewHoopiz() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="h-2.5 w-28 rounded-full bg-white/10" />
      <div className="flex gap-1.5">
        {["A", "B", "C", "D"].map((l, i) => (
          <div key={l} className={`flex h-6 w-10 items-center justify-center rounded text-[8px] font-bold ${i === 1 ? "bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/40" : "bg-white/5 text-white/30"}`}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewHoopGrid() {
  const letters = "LBJCURSD".split("");
  return (
    <div className="flex items-center justify-center">
      <div className="grid grid-cols-4 gap-px">
        {letters.map((l, i) => (
          <div key={i} className={`flex h-6 w-6 items-center justify-center rounded-sm text-[9px] font-bold ${i < 3 ? "bg-sky-500/30 text-sky-300 line-through decoration-sky-400/60" : "bg-white/5 text-white/30"}`}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewHoopMore() {
  return (
    <div className="flex items-center gap-3 justify-center">
      <div className="flex flex-col items-center gap-1">
        <div className="h-8 w-8 rounded-full bg-white/10" />
        <div className="text-[9px] font-bold text-rose-300">27.4</div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex h-4 w-8 items-center justify-center rounded bg-emerald-500/25 text-[7px] font-bold text-emerald-300">+</div>
        <div className="flex h-4 w-8 items-center justify-center rounded bg-blue-500/25 text-[7px] font-bold text-blue-300">-</div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="h-8 w-8 rounded-full bg-white/10" />
        <div className="text-[9px] font-bold text-white/30">?</div>
      </div>
    </div>
  );
}

function PreviewHoopRank() {
  return (
    <div className="flex flex-col gap-1 items-center">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold text-amber-400/60 w-2.5">{n}</span>
          <div className="h-4 w-4 rounded-full bg-white/10" />
          <div className="h-1.5 rounded-full bg-white/10" style={{ width: `${60 - n * 12}px` }} />
        </div>
      ))}
    </div>
  );
}

function PreviewHoopLink() {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      <div className="h-6 w-6 rounded-full bg-violet-400/30 ring-1 ring-violet-400/40" />
      <div className="h-px w-4 bg-violet-400/30" />
      <div className="h-5 w-5 rounded-full bg-white/10 ring-1 ring-white/10" />
      <div className="h-px w-4 bg-white/10" />
      <div className="h-5 w-5 rounded-full bg-white/10 ring-1 ring-white/10" />
      <div className="h-px w-4 bg-violet-400/30" />
      <div className="h-6 w-6 rounded-full bg-emerald-400/30 ring-1 ring-emerald-400/40" />
    </div>
  );
}

/* ─── Score config per daily game ─── */

interface ScoreConfig {
  table: string;
  select: string;
  orderBy: { column: string; ascending: boolean }[];
  formatResult: (entry: Record<string, number | boolean>) => string;
  hasWon: (entry: Record<string, number | boolean>) => boolean;
}

const SCORE_CONFIGS: Record<string, ScoreConfig> = {
  hoopl: {
    table: "hoopl_scores",
    select: "user_id, guesses, time_seconds, won",
    orderBy: [
      { column: "guesses", ascending: true },
      { column: "time_seconds", ascending: true },
    ],
    formatResult: (e) => e.won ? `${e.guesses} essai${(e.guesses as number) > 1 ? "s" : ""}` : "Non trouvé",
    hasWon: (e) => !!e.won,
  },
  hoopixl: {
    table: "hoopixl_scores",
    select: "user_id, guesses, time_seconds, won",
    orderBy: [
      { column: "time_seconds", ascending: true },
      { column: "guesses", ascending: true },
    ],
    formatResult: (e) => e.won ? `${e.guesses} essai${(e.guesses as number) > 1 ? "s" : ""}` : "Non trouvé",
    hasWon: (e) => !!e.won,
  },
  hoopmore: {
    table: "hoopmore_scores",
    select: "user_id, streak, time_seconds",
    orderBy: [
      { column: "streak", ascending: false },
      { column: "time_seconds", ascending: true },
    ],
    formatResult: (e) => `Série de ${e.streak}`,
    hasWon: () => true,
  },
  hoopgrid: {
    table: "hoopgrid_scores",
    select: "user_id, words_found, total_words, time_seconds, won",
    orderBy: [
      { column: "time_seconds", ascending: true },
    ],
    formatResult: (e) => e.won ? `${formatTime(e.time_seconds as number)}` : "Non trouvé",
    hasWon: (e) => !!e.won,
  },
  hooprank: {
    table: "hooprank_scores",
    select: "user_id, score, time_seconds",
    orderBy: [
      { column: "score", ascending: false },
      { column: "time_seconds", ascending: true },
    ],
    formatResult: (e) => `${e.score}/500 pts`,
    hasWon: () => true,
  },
  hooplink: {
    table: "hooplink_scores",
    select: "user_id, chain_length, time_seconds, won",
    orderBy: [
      { column: "chain_length", ascending: true },
      { column: "time_seconds", ascending: true },
    ],
    formatResult: (e) => e.won ? `${e.chain_length} maillon${(e.chain_length as number) > 1 ? "s" : ""}` : "Non trouvé",
    hasWon: (e) => !!e.won,
  },
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m${sec.toString().padStart(2, "0")}s` : `${sec}s`;
}

function getGameDate() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

interface UserDailyScore {
  rank: number;
  total: number;
  label: string;
  won: boolean;
  time: number;
}

/* ─── Game definitions ─── */

interface Game {
  href: string;
  key: string;
  title: string;
  description: string;
  icon: ReactNode;
  color: string;
  tags: string[];
  preview: ReactNode;
}

const games: Game[] = [
  {
    href: "/mini-jeux/hoopl",
    key: "hoopl",
    title: "Hoopl",
    description: "Devine le joueur NBA du jour à partir de ses statistiques. Équipe, conférence, division, stats... chaque essai te rapproche de la réponse.",
    icon: <Target size={24} />,
    color: "#f97316",
    tags: ["Stats", "10 essais"],
    preview: <PreviewHoopl />,
  },
  {
    href: "/mini-jeux/hoopixl",
    key: "hoopixl",
    title: "Hoopixl",
    description: "Une photo pixélisée se révèle lentement. Reconnais le joueur avant que l'image ne devienne nette. Le temps joue contre toi !",
    icon: <Image size={24} />,
    color: "#8b5cf6",
    tags: ["Visuel", "5 essais"],
    preview: <PreviewHoopixl />,
  },
  {
    href: "/mini-jeux/hoopiz",
    key: "hoopiz",
    title: "Hoopiz",
    description: "Quiz de culture générale NBA. Remplis le tableau le plus vite possible avec tes connaissances. Chrono et classement !",
    icon: <Brain size={24} />,
    color: "#10b981",
    tags: ["Quiz", "Culture gé"],
    preview: <PreviewHoopiz />,
  },
  {
    href: "/mini-jeux/hoopgrid",
    key: "hoopgrid",
    title: "HoopGrid",
    description: "Mots mêlés NBA ! Barre les noms cachés dans la grille pour révéler le joueur mystère. Les lettres restantes forment son nom !",
    icon: <Grid3X3 size={24} />,
    color: "#0ea5e9",
    tags: ["Mots mêlés", "Joueur mystère"],
    preview: <PreviewHoopGrid />,
  },
  {
    href: "/mini-jeux/hoopmore",
    key: "hoopmore",
    title: "HoopMore",
    description: "Plus ou moins ? Compare les stats de deux joueurs et enchaîne la plus longue série possible. Un faux pas et c'est terminé !",
    icon: <Flame size={24} />,
    color: "#f43f5e",
    tags: ["Streak", "Stats"],
    preview: <PreviewHoopMore />,
  },
  {
    href: "/mini-jeux/hooprank",
    key: "hooprank",
    title: "HoopRank",
    description: "Cinq joueurs, une stat : classe-les dans le bon ordre. Cinq manches pour prouver que tu connais la NBA sur le bout des doigts.",
    icon: <BarChart3 size={24} />,
    color: "#f59e0b",
    tags: ["Classement", "5 manches"],
    preview: <PreviewHoopRank />,
  },
  {
    href: "/mini-jeux/hooplink",
    key: "hooplink",
    title: "HoopLink",
    description: "Deux joueurs, un défi : trouve le chemin le plus court en nommant des coéquipiers communs. Chaque maillon doit avoir joué dans la même équipe et la même saison que le précédent.",
    icon: <Link2 size={24} />,
    color: "#8b5cf6",
    tags: ["Connexions", "Coéquipiers"],
    preview: <PreviewHoopLink />,
  },
];

export default function MiniJeux() {
  const [dailyScores, setDailyScores] = useState<Record<string, UserDailyScore>>({});

  useEffect(() => {
    async function fetchScores() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const gameDate = getGameDate();
      const results: Record<string, UserDailyScore> = {};

      await Promise.all(
        Object.entries(SCORE_CONFIGS).map(async ([key, config]) => {
          let query = supabase
            .from(config.table)
            .select(config.select)
            .eq("game_date", gameDate);

          for (const order of config.orderBy) {
            query = query.order(order.column, { ascending: order.ascending });
          }

          const { data } = await query.limit(500);
          if (!data || !Array.isArray(data)) return;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rows = data as any[];
          const userEntry = rows.find((e) => e.user_id === user.id);
          if (!userEntry) return;

          const won = config.hasWon(userEntry);

          // Rank among winners for games that filter by won, all players otherwise
          const hasWonFilter = ["hoopl", "hoopixl", "hoopgrid", "hooplink"].includes(key);
          const rankEntries = hasWonFilter
            ? rows.filter((e) => config.hasWon(e))
            : rows;

          const userIndex = rankEntries.findIndex((e) => e.user_id === user.id);

          results[key] = {
            rank: userIndex >= 0 ? userIndex + 1 : -1,
            total: rankEntries.length,
            label: config.formatResult(userEntry),
            won,
            time: userEntry.time_seconds as number,
          };
        })
      );

      setDailyScores(results);
    }

    fetchScores();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Mini-jeux"
        subtitle="Teste tes connaissances NBA"
        image="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&q=80"
      />

      {/* Daily challenge banner */}
      <ScrollReveal variant="scale">
        <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/10 via-card to-card">
          <div className="absolute top-0 right-0 w-40 h-40 opacity-[0.06]">
            <svg viewBox="0 0 100 100" className="w-full h-full text-accent">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" />
              <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div className="relative px-6 py-6 sm:px-8 sm:py-8 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/15">
              <Sparkles size={26} className="text-accent-text" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-text-primary">Défi quotidien</h2>
              <p className="text-sm text-text-muted mt-0.5">
                Chaque jour à minuit, de nouveaux joueurs mystères t'attendent. Joue, compare ton score et défie tes amis !
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-faint">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-accent-text" />
                <span>Reset à minuit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy size={14} className="text-accent-text" />
                <span>Classement du jour</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Games grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {games.map((game, i) => {
          const score = dailyScores[game.key];
          return (
            <ScrollReveal key={game.href} delay={i * 100} variant="up">
              <Link
                href={game.href}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-t bg-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 hover:border-border-hover active:translate-y-0 h-full"
              >
                {/* Preview area */}
                <div
                  className="relative flex items-center justify-center h-28 overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${game.color}18, ${game.color}08)` }}
                >
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(${game.color} 1px, transparent 1px)`, backgroundSize: "12px 12px" }} />
                  <div className="relative">{game.preview}</div>
                  <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${game.color}30, transparent)` }} />

                  {/* Score badge */}
                  {score && (
                    <div className={`absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm ${score.won ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                      {score.won ? <Check size={12} /> : <X size={12} />}
                      {score.won && score.rank > 0 ? `#${score.rank}` : "Terminé"}
                    </div>
                  )}
                </div>

                <div className="p-6 flex flex-col flex-1">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110"
                        style={{ backgroundColor: game.color }}
                      >
                        {game.icon}
                      </div>
                      <div>
                        <h2 className="text-lg font-extrabold text-text-primary group-hover:text-accent-text transition-colors tracking-tight">{game.title}</h2>
                        <div className="flex gap-1.5 mt-0.5">
                          {game.tags.map((tag) => (
                            <span key={tag} className="inline-block rounded-full bg-input px-2 py-0.5 text-[10px] font-semibold text-text-faint">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* User score result */}
                  {score && (
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 mb-3 text-xs ${score.won ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                      {score.won ? (
                        <>
                          <Trophy size={13} className="text-amber-400 shrink-0" />
                          {score.rank > 0 && (
                            <span className="font-extrabold text-emerald-300">#{score.rank}<span className="font-normal text-text-faint">/{score.total}</span></span>
                          )}
                          <span className="text-text-faint">·</span>
                          <span className="text-text-muted font-medium">{score.label}</span>
                          <span className="text-text-faint">·</span>
                          <span className="text-text-faint">{formatTime(score.time)}</span>
                        </>
                      ) : (
                        <>
                          <X size={13} className="text-red-400 shrink-0" />
                          <span className="font-bold text-red-300">{score.label}</span>
                          <span className="text-text-faint">·</span>
                          <span className="text-text-faint">{formatTime(score.time)}</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-[13px] leading-relaxed text-text-muted flex-1 line-clamp-3">
                    {game.description}
                  </p>

                  {/* CTA */}
                  <div
                    className="mt-4 flex items-center gap-1.5 text-sm font-bold opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0"
                    style={{ color: game.color }}
                  >
                    {score ? "Voir le classement" : "Jouer maintenant"}
                    <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </ScrollReveal>
          );
        })}
      </div>

      {/* Coming soon teaser */}
      <ScrollReveal variant="blur">
        <div className="rounded-2xl border border-dashed border-border-t bg-card/50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-text-faint">D'autres mini-jeux sont en préparation...</p>
        </div>
      </ScrollReveal>
    </div>
  );
}
