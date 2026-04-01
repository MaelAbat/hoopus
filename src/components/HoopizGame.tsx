"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, Trophy, CheckCircle, XCircle, RotateCcw, Flag, List, ListOrdered } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

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
}

interface LeaderboardEntry {
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

function LeaderboardSection({ quizId, mode, label }: { quizId: string; mode: string; label: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const fetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("quiz_scores")
      .select("display_name, found_count, total_count, time_seconds, won")
      .eq("quiz_id", quizId)
      .eq("mode", mode)
      .order("found_count", { ascending: false })
      .order("time_seconds", { ascending: true })
      .limit(10);
    setEntries(data || []);
  }, [quizId, mode]);

  useEffect(() => { fetch(); }, [fetch]);

  // Expose refetch via custom event
  useEffect(() => {
    const handler = () => fetch();
    window.addEventListener(`leaderboard-refresh-${quizId}-${mode}`, handler);
    return () => window.removeEventListener(`leaderboard-refresh-${quizId}-${mode}`, handler);
  }, [fetch, quizId, mode]);

  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
        {mode === "ordered" ? <ListOrdered size={12} /> : <List size={12} />}
        {label}
      </h3>
      <div className="divide-y divide-border-t/30">
        {entries.map((entry, i) => (
          <div key={`${entry.display_name}-${i}`} className="flex items-center gap-3 px-1 py-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
              i === 0 ? "bg-accent/20 text-accent-text"
              : i <= 2 ? "bg-input text-text-primary"
              : "text-text-faint"
            }`}>
              {i + 1}
            </span>
            <span className="flex-1 text-sm font-medium text-text-primary truncate">{entry.display_name}</span>
            <span className="text-xs text-text-muted tabular-nums">{entry.found_count}/{entry.total_count}</span>
            <span className="text-xs text-text-faint tabular-nums w-14 text-right">{formatTimeShort(entry.time_seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HoopizGame({ quiz }: { quiz: Quiz }) {
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

  // Auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, []);

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
    if (submitted || !userId) return;
    const supabase = createClient();
    const timeTaken = quiz.timeLimit - timeLeftRef.current;
    const foundCount = foundRef.current.size;
    const didWin = foundCount === total;
    const mode = activeModeRef.current;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();

    const displayName = profile?.display_name || "Anonyme";

    await supabase.from("quiz_scores").upsert({
      user_id: userId,
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
  }, [submitted, userId, quiz.id, quiz.timeLimit, total]);

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

  const timerColor = timeLeft <= 30 ? "text-red-400" : timeLeft <= 60 ? "text-orange-400" : "text-text-primary";
  const timerBg = timeLeft <= 30 ? "bg-red-500/15" : timeLeft <= 60 ? "bg-orange-500/10" : "bg-input";
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

  const resultColor = won ? "text-emerald-400" : "text-red-400";
  const ResultIcon = won ? Trophy : XCircle;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-3">
        {quiz.imageUrl && (
          <div className="mx-auto h-36 sm:h-44 w-full max-w-md overflow-hidden rounded-2xl border border-border-t">
            <img src={quiz.imageUrl} alt={quiz.title} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Hoop<span className="text-accent">iz</span>
          </h1>
          {activeMode === "ordered" && (
            <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[10px] font-bold text-orange-400 uppercase tracking-wider">
              Dans l&apos;ordre
            </span>
          )}
        </div>
        <p className="text-sm text-text-muted">{quiz.description}</p>

        {/* Mode selector */}
        <div className="flex justify-center">
          <div className="flex rounded-lg bg-input p-0.5">
            <button
              onClick={() => switchMode("unordered")}
              disabled={started && !finished}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeMode === "unordered" ? "bg-card text-text-primary shadow-sm" : "text-text-muted"
              } ${started && !finished ? "cursor-not-allowed" : ""}`}
            >
              <List size={13} /> Désordre
            </button>
            <button
              onClick={() => switchMode("ordered")}
              disabled={started && !finished}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeMode === "ordered" ? "bg-card text-text-primary shadow-sm" : "text-text-muted"
              } ${started && !finished ? "cursor-not-allowed" : ""}`}
            >
              <ListOrdered size={13} /> Dans l&apos;ordre
            </button>
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="rounded-2xl bg-card border border-border-t p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={16} className="text-emerald-400" />
              <span className="text-lg font-bold text-text-primary tabular-nums">{found.size}</span>
              <span className="text-sm text-text-faint">/ {total}</span>
            </div>
            <span className="text-xs text-text-faint">({Math.round(progress)}%)</span>
          </div>

          <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${timerBg}`}>
            <Clock size={14} className={timerColor} />
            <span className={`text-sm font-bold tabular-nums ${timerColor}`}>{formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="h-2 rounded-full bg-input overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-500 transition-all duration-500"
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
                className={`w-full rounded-xl bg-sidebar border border-border-t px-4 py-3 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent transition-all ${
                  shake ? "animate-[shake_0.5s_ease-in-out]" : ""
                }`}
              />
            </div>
            {started && (
              <button
                onClick={handleGiveUp}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-3 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors"
                title="Abandonner"
              >
                <Flag size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ResultIcon size={20} className={resultColor} />
                <span className={`text-sm font-bold ${resultColor}`}>{resultMessage}</span>
              </div>
              <button
                onClick={handleRestart}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
              >
                <RotateCcw size={14} /> Rejouer
              </button>
            </div>
            {!userId && (
              <p className="text-xs text-text-faint">
                <Link href="/auth/login" className="text-accent-text hover:underline">Connecte-toi</Link> pour enregistrer ton score au classement
              </p>
            )}
          </div>
        )}
      </div>

      {/* Entries in columns */}
      <div ref={tableRef} className="rounded-2xl bg-card border border-border-t p-3 sm:p-4 overflow-x-auto">
        {(() => {
          const cols: typeof quiz.entries[] = [];
          for (let i = 0; i < quiz.entries.length; i += MAX_PER_COL) {
            cols.push(quiz.entries.slice(i, i + MAX_PER_COL));
          }
          const nextIndex = activeMode === "ordered" ? quiz.entries.findIndex((_, j) => !found.has(j)) : -1;

          return (
            <div className="flex gap-2" style={{ minWidth: cols.length > 2 ? cols.length * 180 : undefined }}>
              {cols.map((col, ci) => (
                <div key={ci} className="flex-1 min-w-[160px] space-y-1.5">
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
                        className={`rounded-lg border p-2.5 min-h-[62px] flex flex-col justify-center transition-all duration-300 ${
                          isFound
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : isRevealed
                              ? "bg-red-500/8 border-red-500/20"
                              : isNext
                                ? "bg-accent/15 border-accent/50 shadow-[0_0_12px_rgba(var(--accent-rgb,249,115,22),0.15)] scale-[1.02]"
                                : "bg-sidebar border-border-t"
                        } ${isLast ? "ring-2 ring-emerald-500/40" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-bold ${isNext ? "text-accent-text" : "text-text-secondary"}`}>{label}</span>
                          {isFound && <CheckCircle size={11} className="text-emerald-400" />}
                          {isRevealed && !isFound && <XCircle size={11} className="text-red-400" />}
                        </div>
                        {isRevealed ? (
                          <p className={`text-xs font-bold truncate ${isFound ? "text-emerald-400" : "text-red-400"}`}>
                            {displayAnswer(entry)}
                          </p>
                        ) : (
                          <div className="h-[18px] w-full rounded bg-input border border-dashed border-border-t flex items-center justify-center">
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
      <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
        <div className="px-4 py-3 border-b border-border-t">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Trophy size={16} className="text-accent-text" />
            Classements
          </h2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <LeaderboardSection quizId={quiz.id} mode="unordered" label="Désordre" />
          <LeaderboardSection quizId={quiz.id} mode="ordered" label="Dans l'ordre" />
        </div>
      </div>

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
