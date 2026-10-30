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

/**
 * Interroge /api/live-scores tant que `enabled` est vrai et que l'onglet est
 * visible. Chaque appel réveille une fonction Vercel : un onglet oublié en
 * arrière-plan ne doit rien coûter, et la reprise au retour sur l'onglet
 * rattrape aussitôt le score.
 *
 * Désactiver le polling garde les derniers scores reçus : le composant qui
 * s'arrête parce que le match est terminé doit continuer d'afficher le score
 * final, pas revenir à celui du rendu serveur.
 */
export function useLiveScores(gameIds: string[], enabled: boolean): Map<string, LiveScore> {
  const [scores, setScores] = useState<Map<string, LiveScore>>(() => new Map());
  const idsKey = [...gameIds].sort().join(",");

  useEffect(() => {
    if (!enabled || idsKey.length === 0) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
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

    function start() {
      if (timer) return;
      tick();
      timer = setInterval(tick, POLL_MS);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function onVisibilityChange() {
      if (document.hidden) stop();
      else start();
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      controller.abort();
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, idsKey]);

  return scores;
}
