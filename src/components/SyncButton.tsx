"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { triggerSync } from "@/lib/actions/sync";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);

    try {
      const res = await triggerSync();
      setResult(res);
    } catch {
      setResult({ ok: false, error: "Erreur inattendue" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        {loading ? "Synchronisation..." : "Synchroniser les données"}
      </button>
      {result && (
        <p className={`mt-1 px-3 text-[10px] ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
          {result.ok ? "Synchronisation réussie !" : result.error}
        </p>
      )}
    </div>
  );
}
