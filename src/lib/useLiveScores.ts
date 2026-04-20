"use client";

import { useEffect, useState } from "react";

export interface LiveScore {
  game_id: string;
  status: number;
  status_text: string;
  home_score: number;
  away_score: number;
}

const POLL_MS = 30_000;

export function useLiveScores(gameIds: string[], enabled: boolean): Map<string, LiveScore> {
  const [scores, setScores] = useState<Map<string, LiveScore>>(() => new Map());
  const idsKey = [...gameIds].sort().join(",");

  useEffect(() => {
    if (!enabled || idsKey.length === 0) {
      setScores(new Map());
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function tick() {
      try {
        const res = await fetch(`/api/live-scores?ids=${encodeURIComponent(idsKey)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { games: LiveScore[] };
        if (cancelled) return;
        setScores(new Map(data.games.map((g) => [g.game_id, g])));
      } catch {
        // network / abort — ignore, next tick will retry
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, [enabled, idsKey]);

  return scores;
}
