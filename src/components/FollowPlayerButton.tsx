"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/context/FavoritesContext";

export default function FollowPlayerButton({ playerId }: { playerId: number }) {
  const { isPlayerFollowed, togglePlayer, loaded } = useFavorites();
  const followed = isPlayerFollowed(playerId);

  if (!loaded) return null;

  return (
    <button
      type="button"
      onClick={() => togglePlayer(playerId)}
      aria-pressed={followed}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
        followed
          ? "bg-accent border border-accent text-white"
          : "bg-input text-text-muted border border-rule hover:text-text-primary hover:border-border-hover"
      }`}
    >
      <Heart size={14} className={followed ? "fill-white" : ""} />
      {followed ? "Suivi" : "Suivre"}
    </button>
  );
}
