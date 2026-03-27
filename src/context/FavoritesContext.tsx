"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface FavoritesContextValue {
  favoriteTeams: string[];
  followedPlayers: number[];
  isTeamFavorite: (tricode: string) => boolean;
  isPlayerFollowed: (playerId: number) => boolean;
  toggleTeam: (tricode: string) => Promise<void>;
  togglePlayer: (playerId: number) => Promise<void>;
  loaded: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favoriteTeams: [],
  followedPlayers: [],
  isTeamFavorite: () => false,
  isPlayerFollowed: () => false,
  toggleTeam: async () => {},
  togglePlayer: async () => {},
  loaded: false,
});

export function useFavorites() {
  return useContext(FavoritesContext);
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = useState<string[]>([]);
  const [players, setPlayers] = useState<number[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load from localStorage cache first for instant render
    try {
      const cached = localStorage.getItem("favorites-cache");
      if (cached) {
        const { t, p } = JSON.parse(cached);
        if (Array.isArray(t)) setTeams(t);
        if (Array.isArray(p)) setPlayers(p);
      }
    } catch {}

    // Then fetch from DB
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoaded(true);
        return;
      }
      setUserId(user.id);
      supabase
        .from("profiles")
        .select("favorite_teams, followed_players")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            const t = data.favorite_teams || [];
            const p = data.followed_players || [];
            setTeams(t);
            setPlayers(p);
            localStorage.setItem("favorites-cache", JSON.stringify({ t, p }));
          }
          setLoaded(true);
        });
    });
  }, []);

  const persist = useCallback(
    (newTeams: string[], newPlayers: number[]) => {
      localStorage.setItem("favorites-cache", JSON.stringify({ t: newTeams, p: newPlayers }));
      if (!userId) return;
      const supabase = createClient();
      supabase
        .from("profiles")
        .update({ favorite_teams: newTeams, followed_players: newPlayers })
        .eq("id", userId)
        .then(() => {});
    },
    [userId]
  );

  const toggleTeam = useCallback(
    async (tricode: string) => {
      setTeams((prev) => {
        const next = prev.includes(tricode)
          ? prev.filter((t) => t !== tricode)
          : [...prev, tricode];
        persist(next, players);
        return next;
      });
    },
    [persist, players]
  );

  const togglePlayer = useCallback(
    async (playerId: number) => {
      setPlayers((prev) => {
        const next = prev.includes(playerId)
          ? prev.filter((p) => p !== playerId)
          : [...prev, playerId];
        persist(teams, next);
        return next;
      });
    },
    [persist, teams]
  );

  const isTeamFavorite = useCallback(
    (tricode: string) => teams.includes(tricode),
    [teams]
  );

  const isPlayerFollowed = useCallback(
    (playerId: number) => players.includes(playerId),
    [players]
  );

  return (
    <FavoritesContext.Provider
      value={{
        favoriteTeams: teams,
        followedPlayers: players,
        isTeamFavorite,
        isPlayerFollowed,
        toggleTeam,
        togglePlayer,
        loaded,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}
