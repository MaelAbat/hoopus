"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { syncEndpoint } from "@/lib/actions/sync";

const SYNC_ENDPOINTS = [
  { key: "games", label: "Matchs" },
  { key: "standings", label: "Classement" },
  { key: "playoffs", label: "Playoffs" },
  { key: "players", label: "Joueurs" },
  { key: "stats", label: "Statistiques" },
  { key: "team-stats", label: "Stats équipes" },
  { key: "rosters", label: "Effectifs" },
  { key: "career", label: "Carrières" },
];

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState("");
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<{ label: string; ok: boolean }[]>([]);

  async function handleSync() {
    setLoading(true);
    setCurrent("");
    setDone(0);
    setResults([]);

    const completed: { label: string; ok: boolean }[] = [];

    for (const endpoint of SYNC_ENDPOINTS) {
      setCurrent(endpoint.label);
      const res = await syncEndpoint(endpoint.key);
      completed.push({ label: endpoint.label, ok: res.ok });
      setResults([...completed]);
      setDone(completed.length);
    }

    setCurrent("");
    setLoading(false);
  }

  const failed = results.filter((r) => !r.ok);

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        {loading
          ? `${current} (${done}/${SYNC_ENDPOINTS.length})`
          : "Synchroniser les données"}
      </button>
      {results.length > 0 && !loading && (
        <p className={`mt-1 px-3 text-[10px] ${failed.length === 0 ? "text-emerald-400" : "text-amber-400"}`}>
          {failed.length === 0
            ? "Synchronisation réussie !"
            : `${results.length - failed.length}/${results.length} OK — Échec: ${failed.map((f) => f.label).join(", ")}`}
        </p>
      )}
    </div>
  );
}
