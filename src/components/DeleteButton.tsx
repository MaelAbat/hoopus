"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

interface DeleteButtonProps {
  onDelete: () => Promise<void>;
}

export default function DeleteButton({ onDelete }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            await onDelete();
            setConfirming(false);
          }}
          className="border border-red-500/40 bg-red-500/10 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-red-500 transition-colors hover:bg-red-500/20"
        >
          Confirmer
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="border border-rule px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="p-2 text-text-faint transition-colors hover:bg-red-500/10 hover:text-red-500"
    >
      <Trash2 size={16} />
    </button>
  );
}
