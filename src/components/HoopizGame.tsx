"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, Trophy, CheckCircle, XCircle, RotateCcw, Flag, List, ListOrdered, Copy, Check, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureAuth, getDisplayName, isAnonymousName } from "@/lib/anonymous-auth";
import { useAchievementNotifier } from "@/components/AchievementProvider";
import { computeVisibleLeaderboard } from "@/lib/leaderboard-utils";
import SignupBanner from "./SignupBanner";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface Quiz {
  id: string;
  title: string;
  description: string;
  timeLimit: number;
  mode: "unordered" | "ordered";
  columns: { key: string; label: string; width?: string }[];
  answerColumn: string;
  entries: { answers: string[]; hints: Record<string, string> }[];
  imageUrl?: string;
  imagePosition?: string;
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  found_count: number;
  total_count: number;
  time_seconds: number;
  won: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimeShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function exactMatch(input: string, answers: string[]): boolean {
  const norm = normalize(input);
  if (norm.length < 2) return false;
  return answers.some((a) => normalize(a) === norm);
}

function fuzzyMatch(input: string, answers: string[]): boolean {
  const norm = normalize(input);
  if (norm.length < 2) return false;
  for (const answer of answers) {
    const normA = normalize(answer);
    if (norm === normA) return true;
    if (norm.length >= 4 && norm.length >= normA.length * 0.8 && levenshtein(norm, normA) <= 1) return true;
  }
  return false;
}

function LeaderboardSection({ quizId, mode, label, userId }: { quizId: string; mode: string; label: string; userId: string | null }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const fetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("quiz_scores")
      .select("user_id, display_name, found_count, total_count, time_seconds, won")
      .eq("quiz_id", quizId)
      .eq("mode", mode)
      .order("found_count", { ascending: false })
      .order("time_seconds", { ascending: true })
      .limit(500);
    setEntries(data || []);
  }, [quizId, mode]);

  useEffect(() => { fetch(); }, [fetch]);

  // Expose refetch via custom event
  useEffect(() => {
    const handler = () => fetch();
    window.addEventListener(`leaderboard-refresh-${quizId}-${mode}`, handler);
    return () => window.removeEventListener(`leaderboard-refresh-${quizId}-${mode}`, handler);
  }, [fetch, quizId, mode]);

  const rows = computeVisibleLeaderboard(entries, userId);
  if (rows.length === 0) return null;

  return (
    <div>
      <h3 className="kicker text-text-faint mb-2 flex items-center gap-1.5">
        {mode === "ordered" ? <ListOrdered size={12} /> : <List size={12} />}
        {label}
      </h3>
      <div className="divide-y divide-rule">
        {rows.map((row, i) =>
          row.type === "separator" ? (
            <div key="sep" className="flex items-center gap-3 px-1 py-1.5">
              <div className="flex-1 border-t border-dashed border-rule" />
              <span className="text-[10px] text-text-faint">...</span>
              <div className="flex-1 border-t border-dashed border-rule" />
            </div>
          ) : (
            <div key={`${row.entry.display_name}-${row.rank}`} className={`relative flex items-center gap-3 px-2 py-2 ${row.isUser ? "bg-accent-light" : ""}`}>
              {row.isUser && <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
              <span className={`tnum flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold ${
                row.rank === 1 ? "bg-accent text-white"
                : row.rank <= 3 ? "bg-input text-text-primary"
                : "text-text-faint"
              }`}>
                {row.rank}
              </span>
              <span className={`flex-1 text-sm truncate ${row.isUser ? "font-bold text-accent-text" : isAnonymousName(row.entry.display_name) ? "italic text-text-muted" : "font-medium text-text-primary"}`}>
                {row.entry.display_name}{row.isUser ? " (toi)" : ""}
              </span>
              <span className="tnum text-xs text-text-muted">{row.entry.found_count}/{row.entry.total_count}</span>
              <span className="tnum text-xs text-text-faint w-14 text-right">{formatTimeShort(row.entry.time_seconds)}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function HoopizGame({ quiz }: { quiz: Quiz }) {
  const pathname = usePathname();
  const { triggerCheck } = useAchievementNotifier();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [activeMode, setActiveMode] = useState<"unordered" | "ordered">(quiz.mode);
  const [found, setFound] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(quiz.timeLimit);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [input, setInput] = useState("");
  const [lastFound, setLastFound] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const total = quiz.entries.length;
  const won = found.size === total;
  const MAX_PER_COL = 10;

  const handleStart = useCallback(() => {
    if (!started) setStarted(true);
  }, [started]);

  const [bestScore, setBestScore] = useState<number | null>(null);

  // Auth state + fetch best score
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id || null;
      setUserId(uid);
      if (uid) {
        const { data: scores } = await supabase
          .from("quiz_scores")
          .select("found_count")
          .eq("user_id", uid)
          .eq("quiz_id", quiz.id)
          .order("found_count", { ascending: false })
          .limit(1);
        if (scores && scores.length > 0) {
          setBestScore(scores[0].found_count);
        }
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, [quiz.id]);

  // Timer
  useEffect(() => {
    if (!started || finished) return;
    if (timeLeft <= 0) {
      setFinished(true);
      return;
    }
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [started, finished, timeLeft]);

  // Win check
  useEffect(() => {
    if (won && !finished) setFinished(true);
  }, [won, finished]);

  // Flash last found
  useEffect(() => {
    if (lastFound === null) return;
    const timer = setTimeout(() => setLastFound(null), 1500);
    return () => clearTimeout(timer);
  }, [lastFound]);

  // Auto-scroll in ordered mode
  useEffect(() => {
    if (activeMode !== "ordered" || finished || !tableRef.current) return;
    const nextIndex = quiz.entries.findIndex((_, i) => !found.has(i));
    if (nextIndex === -1) return;
    const el = tableRef.current.querySelector(`[data-row="${nextIndex}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [found, finished, activeMode, quiz.entries]);

  // Refs for stable access in submit
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;
  const foundRef = useRef(found);
  foundRef.current = found;
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;

  // Submit score
  const submitScore = useCallback(async () => {
    if (submitted) return;
    const supabase = createClient();
    const uid = userId || await ensureAuth(supabase);
    if (!uid) return;

    const timeTaken = quiz.timeLimit - timeLeftRef.current;
    const foundCount = foundRef.current.size;
    const didWin = foundCount === total;
    const mode = activeModeRef.current;

    const displayName = await getDisplayName(supabase, uid);

    await supabase.from("quiz_scores").upsert({
      user_id: uid,
      quiz_id: quiz.id,
      display_name: displayName,
      found_count: foundCount,
      total_count: total,
      time_seconds: timeTaken,
      won: didWin,
      mode,
    }, { onConflict: "user_id,quiz_id,mode" });

    setSubmitted(true);
    // Refresh leaderboard for the played mode
    window.dispatchEvent(new Event(`leaderboard-refresh-${quiz.id}-${mode}`));
    triggerCheck();
  }, [submitted, userId, quiz.id, quiz.timeLimit, total, triggerCheck]);

  // Auto-submit when game ends
  useEffect(() => {
    if (!finished || submitted || !userId) return;
    submitScore();
  }, [finished, submitted, userId, submitScore]);

  // Match helper
  function tryMatch(value: string, strict: boolean): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;

    const matcher = strict ? exactMatch : fuzzyMatch;

    if (activeMode === "ordered") {
      const nextIndex = quiz.entries.findIndex((_, i) => !found.has(i));
      if (nextIndex === -1) return false;
      if (!matcher(trimmed, quiz.entries[nextIndex].answers)) return false;
      const newFound = new Set(found);
      newFound.add(nextIndex);
      setFound(newFound);
      setLastFound(nextIndex);
      setInput("");
      return true;
    }

    const matched: number[] = [];
    for (let i = 0; i < quiz.entries.length; i++) {
      if (found.has(i)) continue;
      if (matcher(trimmed, quiz.entries[i].answers)) matched.push(i);
    }

    if (matched.length > 0) {
      const newFound = new Set(found);
      for (const idx of matched) newFound.add(idx);
      setFound(newFound);
      setLastFound(matched[matched.length - 1]);
      setInput("");
      return true;
    }
    return false;
  }

  function handleInput(value: string) {
    setInput(value);
    if (!value.trim()) return;
    handleStart();
    tryMatch(value, true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && input.trim()) {
      if (!tryMatch(input, false)) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    }
  }

  function handleGiveUp() {
    if (!started || finished) return;
    setGaveUp(true);
    setFinished(true);
  }

  function handleRestart() {
    setFound(new Set());
    setTimeLeft(quiz.timeLimit);
    setStarted(false);
    setFinished(false);
    setGaveUp(false);
    setInput("");
    setLastFound(null);
    setSubmitted(false);
    inputRef.current?.focus();
  }

  function switchMode(mode: "unordered" | "ordered") {
    if (mode === activeMode) return;
    if (started && !finished) return;
    // Reset game when switching mode
    setActiveMode(mode);
    setFound(new Set());
    setTimeLeft(quiz.timeLimit);
    setStarted(false);
    setFinished(false);
    setGaveUp(false);
    setInput("");
    setLastFound(null);
    setSubmitted(false);
  }

  const timerColor = timeLeft <= 30 ? "text-red-500" : timeLeft <= 60 ? "text-text-primary" : "text-text-primary";
  const timerBg = timeLeft <= 30 ? "bg-red-500/10 border border-red-500/40" : timeLeft <= 60 ? "bg-input border border-border-hover" : "bg-input border border-rule";
  const progress = total > 0 ? (found.size / total) * 100 : 0;

  const displayAnswer = (entry: typeof quiz.entries[0]) => {
    const name = entry.answers[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const resultMessage = won
    ? `Parfait ! ${total}/${total}`
    : gaveUp
      ? `Abandon ! ${found.size}/${total}`
      : `Temps écoulé ! ${found.size}/${total}`;

  const resultColor = won ? "text-accent-text" : "text-red-500";
  const ResultIcon = won ? Trophy : XCircle;
  const [copied, setCopied] = useState(false);

  function buildShareText() {
    const timeTaken = quiz.timeLimit - timeLeft;
    const modeLabel = activeMode === "ordered" ? "Dans l'ordre" : "Désordre";
    const result = won
      ? `${found.size}/${total} en ${formatTimeShort(timeTaken)}`
      : `${found.size}/${total}`;
    return `Hoopiz - ${quiz.title} (${modeLabel})\n\n${result}\n\nhttps://www.hoopus.fr/mini-jeux/hoopiz/${quiz.id}`;
  }

  function handleShare() {
    const text = buildShareText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "width=550,height=420");
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildShareText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inProgress = started && !finished && !gaveUp;

  return (
    <div className="space-y-5">
      {/* Back button — Link for smooth transition, intercepted only when in progress */}
      {inProgress ? (
        <button
          onClick={() => setShowLeaveModal(true)}
          className="inline-flex items-center gap-2 sm:gap-1.5 border border-rule bg-card px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:border-border-hover hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={12} /> Tous les quiz
        </button>
      ) : (
        <Link
          href="/mini-jeux/hoopiz"
          className="inline-flex items-center gap-2 sm:gap-1.5 border border-rule bg-card px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:border-border-hover hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={12} /> Tous les quiz
        </Link>
      )}

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowLeaveModal(false)}>
          <div className="mx-4 w-full max-w-sm bg-card border border-rule p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-text-primary">Quitter le quiz ?</h3>
            <p className="text-sm text-text-muted">Ta progression sera perdue si tu quittes maintenant.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 border border-border-hover px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-text-primary hover:bg-input transition-colors"
              >
                Continuer
              </button>
              <Link
                href="/mini-jeux/hoopiz"
                className="flex-1 border border-red-500/40 bg-red-500/10 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-red-500 hover:bg-red-500/20 transition-colors text-center"
              >
                Abandonner
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-3">
        {quiz.imageUrl && (
          <div className="mx-auto h-36 sm:h-44 w-full max-w-md overflow-hidden border border-rule">
            <img src={quiz.imageUrl} alt={quiz.title} className="h-full w-full object-cover grayscale" style={{ objectPosition: `center ${quiz.imagePosition || "center"}` }} />
          </div>
        )}
        <div className="flex items-center justify-center gap-2.5">
          <h1 className="font-display text-3xl sm:text-4xl text-text-primary">
            Hoop<span className="text-accent">iz</span>
          </h1>
          {activeMode === "ordered" && (
            <span className="border border-rule px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
              Dans l&apos;ordre
            </span>
          )}
        </div>
        <p className="text-sm text-text-muted">{quiz.description}</p>
        {bestScore !== null && !started && (
          <p className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-accent-text">
            <Trophy size={12} />
            Record à battre : <span className="tnum">{bestScore}/{total}</span>
          </p>
        )}

        {/* Mode selector */}
        <div className="flex justify-center">
          <div className="flex border border-rule bg-card">
            <button
              onClick={() => switchMode("unordered")}
              disabled={started && !finished}
              className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                activeMode === "unordered" ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
              } ${started && !finished ? "cursor-not-allowed" : ""}`}
            >
              <List size={14} /> Désordre
            </button>
            <button
              onClick={() => switchMode("ordered")}
              disabled={started && !finished}
              className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                activeMode === "ordered" ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
              } ${started && !finished ? "cursor-not-allowed" : ""}`}
            >
              <ListOrdered size={14} /> Dans l&apos;ordre
            </button>
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="bg-card border border-rule p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="tnum font-display text-2xl text-text-primary">{found.size}</span>
              <span className="tnum text-sm text-text-faint">/ {total}</span>
            </div>
            <span className="tnum kicker text-text-faint">{Math.round(progress)}%</span>
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1.5 ${timerBg}`}>
            <Clock size={14} className={timerColor} />
            <span className={`tnum text-sm font-bold ${timerColor}`}>{formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="h-1.5 bg-input overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {!finished ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => handleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleStart}
                placeholder="Tape une réponse..."
                autoComplete="off"
                className={`w-full bg-input border border-rule px-4 py-3 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent transition-colors ${
                  shake ? "animate-[shake_0.5s_ease-in-out]" : ""
                }`}
              />
            </div>
            {started && (
              <button
                onClick={handleGiveUp}
                className="shrink-0 inline-flex items-center gap-1.5 border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-xs font-bold text-red-500 hover:bg-red-500/20 active:scale-95 transition-all"
                title="Abandonner"
                aria-label="Abandonner"
              >
                <Flag size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ResultIcon size={20} className={resultColor} />
                <span className={`font-display text-lg ${resultColor}`}>{resultMessage}</span>
              </div>
              <button
                onClick={handleRestart}
                className="inline-flex items-center gap-1.5 bg-accent px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white hover:bg-accent-hover transition-colors"
              >
                <RotateCcw size={14} /> Rejouer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Share buttons */}
      {finished && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
          <button
            onClick={handleShare}
            className="inline-flex items-center justify-center gap-2 bg-accent px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            Partager
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 border border-border-hover px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-text-primary transition-colors hover:bg-input"
          >
            {copied ? <><Check size={14} className="text-accent-text" /> Copié !</> : <><Copy size={14} /> Copier</>}
          </button>
        </div>
      )}

      {/* Entries in columns */}
      <div ref={tableRef} className="bg-card border border-rule p-3 sm:p-4 sm:overflow-x-auto">
        {(() => {
          const cols: typeof quiz.entries[] = [];
          for (let i = 0; i < quiz.entries.length; i += MAX_PER_COL) {
            cols.push(quiz.entries.slice(i, i + MAX_PER_COL));
          }
          const nextIndex = activeMode === "ordered" ? quiz.entries.findIndex((_, j) => !found.has(j)) : -1;

          return (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
              {cols.map((col, ci) => (
                <div key={ci} className="min-w-0 sm:flex-1 sm:min-w-[160px] space-y-1.5">
                  {col.map((entry, ei) => {
                    const i = ci * MAX_PER_COL + ei;
                    const isFound = found.has(i);
                    const isLast = lastFound === i;
                    const isRevealed = isFound || finished;
                    const isNext = i === nextIndex && !finished;
                    const label = entry.hints.label || entry.hints.year || "";

                    return (
                      <div
                        key={i}
                        data-row={i}
                        className={`relative border p-2.5 min-h-[62px] flex flex-col justify-center transition-colors duration-300 ${
                          isFound
                            ? "bg-emerald-500/10 border-emerald-600/40"
                            : isRevealed
                              ? "bg-red-500/10 border-red-500/30"
                              : isNext
                                ? "bg-accent-light border-accent"
                                : "bg-input border-rule"
                        } ${isLast ? "ring-1 ring-emerald-600/50" : ""}`}
                      >
                        {isNext && <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-mono text-[10px] uppercase tracking-wider ${isNext ? "text-accent-text" : "text-text-secondary"}`}>{label}</span>
                          {isFound && <CheckCircle size={11} className="text-emerald-600" />}
                          {isRevealed && !isFound && <XCircle size={11} className="text-red-500" />}
                        </div>
                        {isRevealed ? (
                          <p className={`text-xs font-bold truncate ${isFound ? "text-emerald-600" : "text-red-500"}`}>
                            {displayAnswer(entry)}
                          </p>
                        ) : (
                          <div className="h-[18px] w-full bg-card border border-dashed border-rule flex items-center justify-center">
                            <span className="text-[10px] text-text-faint select-none">?</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Leaderboards */}
      <div className="bg-card border border-rule overflow-hidden">
        <div className="px-4 py-3 border-b border-rule flex items-center gap-2.5">
          <span className="block h-3 w-1 bg-accent shrink-0" />
          <h2 className="kicker text-text-primary flex items-center gap-2">
            <Trophy size={14} className="text-accent-text" />
            Classements
          </h2>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-4">
          <LeaderboardSection quizId={quiz.id} mode="unordered" label="Désordre" userId={userId} />
          <LeaderboardSection quizId={quiz.id} mode="ordered" label="Dans l'ordre" userId={userId} />
        </div>
      </div>

      <SignupBanner show={submitted} />

      {/* Shake animation */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
