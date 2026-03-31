"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Clock, Trophy, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import type { Quiz } from "@/lib/quiz-data";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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

  // Scroll to last found entry
  useEffect(() => {
    if (lastFound === null || !tableRef.current) return;
    const row = tableRef.current.querySelector(`[data-row="${lastFound}"]`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [lastFound]);

  // Check answer
  function handleInput(value: string) {
    setInput(value);
    if (!value.trim()) return;
    handleStart();

    const normalized = normalize(value);
    if (!normalized) return;

    // Check against all unfound entries
    for (let i = 0; i < quiz.entries.length; i++) {
      if (found.has(i)) continue;
      const entry = quiz.entries[i];
      if (entry.answers.some((a) => normalize(a) === normalized)) {
        const newFound = new Set(found);
        newFound.add(i);
        setFound(newFound);
        setLastFound(i);
        setInput("");
        return;
      }
    }
  }

  // Submit on enter (shake if wrong)
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && input.trim()) {
      const normalized = normalize(input);
      const isCorrect = quiz.entries.some(
        (entry, i) => !found.has(i) && entry.answers.some((a) => normalize(a) === normalized)
      );
      if (!isCorrect) {
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

      {/* Table */}
      <div ref={tableRef} className="rounded-2xl bg-card border border-border-t overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-t bg-card">
                {quiz.columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 sm:px-4 py-3 text-left text-xs font-bold text-text-muted uppercase tracking-wider"
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quiz.entries.map((entry, i) => {
                const isFound = found.has(i);
                const isLast = lastFound === i;
                const isRevealed = isFound || finished;

                return (
                  <tr
                    key={i}
                    data-row={i}
                    className={`border-b border-border-t/30 transition-all duration-500 ${
                      isLast ? "bg-emerald-500/10" : ""
                    }`}
                  >
                    {quiz.columns.map((col) => {
                      if (col.key === quiz.answerColumn) {
                        // Answer column
                        return (
                          <td key={col.key} className="px-3 sm:px-4 py-2.5">
                            {isRevealed ? (
                              <span className={`inline-flex items-center gap-1.5 font-bold transition-all duration-300 ${
                                isFound ? "text-emerald-400" : "text-red-400"
                              }`}>
                                {isFound ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                {displayAnswer(entry)}
                              </span>
                            ) : (
                              <span className="inline-block h-6 w-24 sm:w-32 rounded bg-input/80" />
                            )}
                          </td>
                        );
                      }
                      // Hint columns
                      return (
                        <td key={col.key} className="px-3 sm:px-4 py-2.5 text-text-secondary whitespace-nowrap">
                          {entry.hints[col.key] || ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
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
