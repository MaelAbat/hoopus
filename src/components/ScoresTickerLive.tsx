"use client";

import { useEffect, useState } from "react";
import ScoresTicker from "./ScoresTicker";
import type { TickerData } from "@/lib/ticker";

/** Relecture du bandeau tant qu'un match est en cours. */
const POLL_MS = 30_000;

/**
 * Bandeau des scores, lu par /api/ticker et non plus rendu dans le HTML de la
 * page : il reste à jour même sur une page gardée vingt-quatre heures en cache.
 *
 * La route est mise en cache par le CDN : les relectures de tous les visiteurs
 * se partagent une exécution. Elles s'arrêtent quand aucun match n'est en cours
 * et quand l'onglet est caché, puis reprennent aussitôt au retour.
 */
export default function ScoresTickerLive() {
  const [data, setData] = useState<(TickerData & { live: boolean }) | null>(null);
  const live = data?.live ?? false;

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const res = await fetch("/api/ticker", { signal: controller.signal });
        if (res.ok) setData(await res.json());
      } catch {
        // Réseau ou abandon : le prochain passage réessaiera.
      }
    }

    function start() {
      if (timer || !live) return;
      timer = setInterval(load, POLL_MS);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stop();
      } else if (live) {
        load();
        start();
      }
    }

    if (!data) load();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      controller.abort();
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // `data` n'est lu que pour le premier chargement : seul `live` relance l'effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  if (!data) return null;
  const { results, upcoming } = data;

  if (results.length > 0 && upcoming.length > 0) {
    return (
      <div className="space-y-2">
        <ScoresTicker games={results} mode="results" />
        <ScoresTicker games={upcoming} mode="upcoming" />
      </div>
    );
  }
  if (results.length > 0) return <ScoresTicker games={results} mode="results" />;
  if (upcoming.length > 0) return <ScoresTicker games={upcoming} mode="upcoming" />;
  return null;
}
