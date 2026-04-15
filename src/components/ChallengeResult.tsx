"use client";

import { useMemo } from "react";
import { Trophy, Clock, Swords } from "lucide-react";
import ChallengeShare from "./ChallengeShare";

export interface ChallengeResultProps {
  challengerScore: number;
  challengerTime: number;
  challengerWon: boolean;
  myScore: number;
  myTime: number;
  myWon: boolean;
  gameName: string;
  gameDate: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

type Winner = "challenger" | "me" | "tie";

export default function ChallengeResult({
  challengerScore,
  challengerTime,
  challengerWon,
  myScore,
  myTime,
  myWon,
  gameName,
  gameDate,
}: ChallengeResultProps) {
  const winner: Winner = useMemo(() => {
    // Won status takes priority
    if (myWon && !challengerWon) return "me";
    if (!myWon && challengerWon) return "challenger";
    if (!myWon && !challengerWon) return "tie";

    // Both won: higher score wins (for hoopl-like games, lower guesses = higher "score" inverted by caller)
    if (myScore > challengerScore) return "me";
    if (myScore < challengerScore) return "challenger";

    // Same score: faster time wins
    if (myTime < challengerTime) return "me";
    if (myTime > challengerTime) return "challenger";

    return "tie";
  }, [myScore, myTime, myWon, challengerScore, challengerTime, challengerWon]);

  const verdictText = winner === "me"
    ? "Vous remportez le défi !"
    : winner === "challenger"
      ? "Votre adversaire l'emporte..."
      : "Égalité parfaite !";

  const verdictClass = winner === "me"
    ? "text-emerald-400"
    : winner === "challenger"
      ? "text-red-400"
      : "text-amber-400";

  return (
    <div className="rounded-2xl border border-border-t bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
          <Swords size={20} className="text-accent-text" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-text-primary">Résultat du défi</h3>
          <p className={`text-sm font-bold ${verdictClass}`}>{verdictText}</p>
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        {/* Header row */}
        <div className="text-xs font-bold text-text-faint uppercase tracking-wide">Défi</div>
        <div />
        <div className="text-xs font-bold text-text-faint uppercase tracking-wide">Vous</div>

        {/* Won status */}
        <div className={`rounded-lg px-3 py-2 font-bold ${
          winner === "challenger" ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30" : challengerWon ? "bg-white/5 text-text-muted" : "bg-red-500/10 text-red-400"
        }`}>
          {challengerWon ? "Gagné" : "Perdu"}
        </div>
        <div className="flex items-center justify-center">
          <Trophy size={16} className="text-text-faint" />
        </div>
        <div className={`rounded-lg px-3 py-2 font-bold ${
          winner === "me" ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30" : myWon ? "bg-white/5 text-text-muted" : "bg-red-500/10 text-red-400"
        }`}>
          {myWon ? "Gagné" : "Perdu"}
        </div>

        {/* Score */}
        <div className={`rounded-lg px-3 py-2 font-bold ${
          winner === "challenger" && challengerWon ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-text-muted"
        }`}>
          {challengerScore}
        </div>
        <div className="flex items-center justify-center text-xs text-text-faint font-semibold">Score</div>
        <div className={`rounded-lg px-3 py-2 font-bold ${
          winner === "me" && myWon ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-text-muted"
        }`}>
          {myScore}
        </div>

        {/* Time */}
        <div className={`rounded-lg px-3 py-2 font-bold ${
          winner === "challenger" && challengerWon ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-text-muted"
        }`}>
          {formatTime(challengerTime)}
        </div>
        <div className="flex items-center justify-center">
          <Clock size={16} className="text-text-faint" />
        </div>
        <div className={`rounded-lg px-3 py-2 font-bold ${
          winner === "me" && myWon ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-text-muted"
        }`}>
          {formatTime(myTime)}
        </div>
      </div>

      {/* Re-challenge button */}
      <div className="flex justify-center pt-1">
        <ChallengeShare
          gameName={gameName}
          gameDate={gameDate}
          score={myScore}
          timeSeconds={myTime}
          won={myWon}
        />
      </div>
    </div>
  );
}
