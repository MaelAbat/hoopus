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
    ? "text-emerald-500"
    : winner === "challenger"
      ? "text-red-500"
      : "text-accent-text";

  return (
    <div className="relative overflow-hidden border border-rule bg-card p-6 sm:p-8 space-y-5">
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center border border-rule bg-input">
          <Swords size={20} className="text-accent-text" />
        </div>
        <div>
          <p className="kicker text-text-faint">Résultat du défi</p>
          <p className={`font-display text-2xl leading-none ${verdictClass}`}>{verdictText}</p>
        </div>
      </div>

      {/* Side-by-side comparison — mini box-score */}
      <div className="grid grid-cols-3 gap-px border border-rule bg-rule text-center">
        {/* Header row */}
        <div className="kicker bg-card px-3 py-2 text-text-faint">Défi</div>
        <div className="bg-card" />
        <div className="kicker bg-card px-3 py-2 text-text-faint">Vous</div>

        {/* Won status */}
        <div className={`px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-wider ${
          winner === "challenger" ? "bg-emerald-600 text-white" : challengerWon ? "bg-card text-text-muted" : "bg-red-600 text-white"
        }`}>
          {challengerWon ? "Gagné" : "Perdu"}
        </div>
        <div className="flex items-center justify-center bg-card">
          <Trophy size={15} className="text-text-faint" />
        </div>
        <div className={`px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-wider ${
          winner === "me" ? "bg-emerald-600 text-white" : myWon ? "bg-card text-text-muted" : "bg-red-600 text-white"
        }`}>
          {myWon ? "Gagné" : "Perdu"}
        </div>

        {/* Score */}
        <div className={`tnum px-3 py-2.5 font-display text-2xl ${
          winner === "challenger" && challengerWon ? "bg-accent text-white" : "bg-card text-text-muted"
        }`}>
          {challengerScore}
        </div>
        <div className="flex items-center justify-center bg-card kicker text-text-faint">Score</div>
        <div className={`tnum px-3 py-2.5 font-display text-2xl ${
          winner === "me" && myWon ? "bg-accent text-white" : "bg-card text-text-muted"
        }`}>
          {myScore}
        </div>

        {/* Time */}
        <div className={`tnum px-3 py-2.5 font-mono text-sm font-bold ${
          winner === "challenger" && challengerWon ? "bg-accent-light text-text-primary" : "bg-card text-text-muted"
        }`}>
          {formatTime(challengerTime)}
        </div>
        <div className="flex items-center justify-center bg-card">
          <Clock size={15} className="text-text-faint" />
        </div>
        <div className={`tnum px-3 py-2.5 font-mono text-sm font-bold ${
          winner === "me" && myWon ? "bg-accent-light text-text-primary" : "bg-card text-text-muted"
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
