"use client";

import { Star } from "lucide-react";
import { useFavorites } from "@/context/FavoritesContext";

export default function FavoriteTeamButton({ tricode }: { tricode: string }) {
  const { isTeamFavorite, toggleTeam, loaded } = useFavorites();
  const fav = isTeamFavorite(tricode);

  if (!loaded) return null;

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTeam(tricode); }}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 transition-all ${
        fav
          ? "text-accent"
          : "text-text-faint hover:text-accent/70"
      }`}
      title={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <Star size={16} className={fav ? "fill-accent" : ""} />
    </button>
  );
}
