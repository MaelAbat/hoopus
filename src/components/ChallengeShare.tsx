"use client";

import { useState } from "react";
import { Swords, Check } from "lucide-react";

export interface ChallengeShareProps {
  gameName: string;       // "hoopl", "hoopgrid", etc.
  gameDate: string;       // "2026-4-15"
  score: number;          // user's score
  timeSeconds: number;    // user's time
  won: boolean;
}

function encodeChallenge(date: string, score: number, time: number, won: boolean): string {
  const payload = `${date},${score},${time},${won ? 1 : 0}`;
  if (typeof window !== "undefined") {
    return btoa(payload);
  }
  return Buffer.from(payload).toString("base64");
}

export default function ChallengeShare({
  gameName,
  gameDate,
  score,
  timeSeconds,
  won,
}: ChallengeShareProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const encoded = encodeChallenge(gameDate, score, timeSeconds, won);
    const url = `${window.location.origin}/mini-jeux/${gameName}?challenge=${encoded}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2.5 bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
    >
      {copied ? (
        <>
          <Check size={15} strokeWidth={2} />
          Lien copié
        </>
      ) : (
        <>
          <Swords size={15} strokeWidth={2} />
          Défier un ami
        </>
      )}
    </button>
  );
}

/** Decode a challenge string back into its components. Returns null if invalid. */
export function decodeChallenge(encoded: string): {
  date: string;
  score: number;
  time: number;
  won: boolean;
} | null {
  try {
    const decoded = typeof window !== "undefined"
      ? atob(encoded)
      : Buffer.from(encoded, "base64").toString();
    const parts = decoded.split(",");
    if (parts.length !== 4) return null;
    return {
      date: parts[0],
      score: Number(parts[1]),
      time: Number(parts[2]),
      won: parts[3] === "1",
    };
  } catch {
    return null;
  }
}
