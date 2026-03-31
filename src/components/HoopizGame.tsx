"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Clock, Trophy, CheckCircle, XCircle, RotateCcw } from "lucide-react";

export interface Quiz {
  id: string;
  title: string;
  description: string;
  timeLimit: number;
  mode: "unordered" | "ordered";
  columns: { key: string; label: string; width?: string }[];
  answerColumn: string;
  entries: { answers: string[]; hints: Record<string, string> }[];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Levenshtein distance between two strings */
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

/** Exact match only (for auto-validate on keystroke) */
function exactMatch(input: string, answers: string[]): boolean {
  const norm = normalize(input);
  if (norm.length < 4) return false; // "heat" = 4, "mavs" = 4, "cavs" = 4
  return answers.some((a) => normalize(a) === norm);
}

/** Fuzzy match with typo tolerance (for Enter key validation) */
function fuzzyMatch(input: string, answers: string[]): boolean {
  const norm = normalize(input);
  if (norm.length < 4) return false;
  for (const answer of answers) {
    const normA = normalize(answer);
    if (norm === normA) return true;
    if (norm.length >= 4 && norm.length >= normA.length * 0.8 && levenshtein(norm, normA) <= 1) return true;
  }
  return false;
}

export default function HoopizGame({ quiz }: { quiz: Quiz }) {
  const [found, setFound] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(quiz.timeLimit);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [input, setInput] = useState("");
  const [lastFound, setLastFound] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const total = quiz.entries.length;
  const won = found.size === total;

  // Start game on first input
  const handleStart = useCallback(() => {
    if (!started) setStarted(true);
  }, [started]);

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
    if (won && !finished) {
      setFinished(true);
    }
  }, [won, finished]);

  // Flash last found entry
  useEffect(() => {
    if (lastFound === null) return;
    const timer = setTimeout(() => setLastFound(null), 1500);
    return () => clearTimeout(timer);
  }, [lastFound]);

  // Match helper
  function tryMatch(value: string, strict: boolean): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;

    const matcher = strict ? exactMatch : fuzzyMatch;

    if (quiz.mode === "ordered") {
      // Ordered mode: must guess the next unfound entry in sequence
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

    // Unordered mode: fills ALL matching rows at once
    const matched: number[] = [];
    for (let i = 0; i < quiz.entries.length; i++) {
      if (found.has(i)) continue;
      if (matcher(trimmed, quiz.entries[i].answers)) {
        matched.push(i);
      }
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

  // Auto-validate on keystroke (exact match only — no typo tolerance)
  function handleInput(value: string) {
    setInput(value);
    if (!value.trim()) return;
    handleStart();
    tryMatch(value, true);
  }

  // Fuzzy match on Enter (tolerates 1 typo)
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && input.trim()) {
      if (!tryMatch(input, false)) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    }
  }

  // Restart
  function handleRestart() {
    setFound(new Set());
    setTimeLeft(quiz.timeLimit);
    setStarted(false);
    setFinished(false);
    setInput("");
    setLastFound(null);
    inputRef.current?.focus();
  }

  // Timer color
  const timerColor = timeLeft <= 30 ? "text-red-400" : timeLeft <= 60 ? "text-orange-400" : "text-text-primary";
  const timerBg = timeLeft <= 30 ? "bg-red-500/15" : timeLeft <= 60 ? "bg-orange-500/10" : "bg-input";

  // Progress percentage
  const progress = total > 0 ? (found.size / total) * 100 : 0;

  // Display name for found answers
  const displayAnswer = (entry: typeof quiz.entries[0]) => {
    // Capitalize first letter of first accepted answer
    const name = entry.answers[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
          Hoop<span className="text-accent">iz</span>
        </h1>
        <p className="text-sm text-text-muted">{quiz.description}</p>
      </div>

      {/* Score bar */}
      <div className="rounded-2xl bg-card border border-border-t p-4 space-y-3">
        <div className="flex items-center justify-between">
          {/* Score */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={16} className="text-emerald-400" />
              <span className="text-lg font-bold text-text-primary tabular-nums">{found.size}</span>
              <span className="text-sm text-text-faint">/ {total}</span>
            </div>
            <span className="text-xs text-text-faint">({Math.round(progress)}%)</span>
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${timerBg}`}>
            <Clock size={14} className={timerColor} />
            <span className={`text-sm font-bold tabular-nums ${timerColor}`}>{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-input overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Input */}
        {!finished ? (
          <div className="relative">
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
        ) : (
          <div className="flex items-center justify-between gap-3">
            {/* Result */}
            <div className="flex items-center gap-2">
              {won ? (
                <>
                  <Trophy size={20} className="text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">Parfait ! {total}/{total}</span>
                </>
              ) : (
                <>
                  <XCircle size={20} className="text-red-400" />
                  <span className="text-sm font-bold text-red-400">Temps écoulé ! {found.size}/{total}</span>
                </>
              )}
            </div>
            <button
              onClick={handleRestart}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
            >
              <RotateCcw size={14} /> Rejouer
            </button>
          </div>
        )}
      </div>

      {/* Entries grid */}
      <div ref={tableRef} className="rounded-2xl bg-card border border-border-t p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {quiz.entries.map((entry, i) => {
            const isFound = found.has(i);
            const isLast = lastFound === i;
            const isRevealed = isFound || finished;
            const isNext = quiz.mode === "ordered" && !finished && i === quiz.entries.findIndex((_, j) => !found.has(j));
            const label = entry.hints.label || entry.hints.year || "";

            return (
              <div
                key={i}
                data-row={i}
                className={`rounded-lg border p-2.5 transition-all duration-300 ${
                  isFound
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : isRevealed
                      ? "bg-red-500/8 border-red-500/20"
                      : isNext
                        ? "bg-accent/5 border-accent/30"
                        : "bg-sidebar border-border-t"
                } ${isLast ? "ring-2 ring-emerald-500/40" : ""}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-bold text-text-secondary">{label}</span>
                  {isFound && <CheckCircle size={11} className="text-emerald-400" />}
                  {isRevealed && !isFound && <XCircle size={11} className="text-red-400" />}
                  {isNext && !isRevealed && <span className="text-[9px] font-bold text-accent-text">SUIVANT</span>}
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
