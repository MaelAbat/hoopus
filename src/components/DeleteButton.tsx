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
          className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors"
        >
          Confirmer
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/10 transition-colors"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-lg p-2 text-gray-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
    >
      <Trash2 size={16} />
    </button>
  );
}
