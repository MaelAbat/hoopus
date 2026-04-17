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
      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
        followed
          ? "bg-accent/15 text-accent border border-accent/30"
          : "bg-input text-text-muted border border-border-t hover:text-text-primary hover:border-border-hover"
      }`}
    >
      <Heart size={14} className={followed ? "fill-accent" : ""} />
      {followed ? "Suivi" : "Suivre"}
    </button>
  );
}
