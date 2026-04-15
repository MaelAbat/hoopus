"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useFavorites } from "@/context/FavoritesContext";
import { createClient } from "@/lib/supabase/client";
import { getCurrentSeason } from "@/lib/season";
import { teamLogoUrl } from "@/lib/nba-teams";

interface GameAlert {
  id: string;
  type: "game";
  team: string;
  opponent: string;
  homeTeam: string;
  gameId: string;
  time: string;
}

interface InjuryAlert {
  id: string;
  type: "injury";
  playerName: string;
  team: string;
  status: string;
  injuryType: string | null;
}

type Alert = GameAlert | InjuryAlert;

export default function FavoriteAlerts() {
  const { favoriteTeams, loaded } = useFavorites();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loaded || favoriteTeams.length === 0) {
      setReady(true);
      return;
    }

    const supabase = createClient();
    const season = getCurrentSeason();

    async function fetchAlerts() {
      const results: Alert[] = [];

      // Get today's date in ET (approximate UTC-5)
      const now = new Date();
      const et = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      const todayStr = et.toISOString().slice(0, 10);

      // Games today for favorite teams
      const { data: games } = await supabase
        .from("games")
        .select("game_id, home_team, away_team, game_time, status_text")
        .eq("status", 1)
        .eq("game_date", todayStr)
        .or(favoriteTeams.map((t) => `home_team.eq.${t},away_team.eq.${t}`).join(","));

      if (games) {
        for (const g of games) {
          const isFavHome = favoriteTeams.includes(g.home_team);
          const team = isFavHome ? g.home_team : g.away_team;
          const opponent = isFavHome ? g.away_team : g.home_team;
          results.push({
            id: `game-${g.game_id}`,
            type: "game",
            team,
            opponent,
            homeTeam: g.home_team,
            gameId: g.game_id,
            time: g.game_time || g.status_text || "",
          });
        }
      }

      // Recent injuries for favorite teams
      const { data: injuries } = await supabase
        .from("injuries")
        .select("id, player_name, team, status, injury_type")
        .eq("season", season)
        .in("team", favoriteTeams)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (injuries) {
        for (const inj of injuries) {
          results.push({
            id: `injury-${inj.id}`,
            type: "injury",
            playerName: inj.player_name,
            team: inj.team,
            status: inj.status,
            injuryType: inj.injury_type,
          });
        }
      }

      setAlerts(results);
      setReady(true);
    }

    fetchAlerts();
  }, [loaded, favoriteTeams]);

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));

  if (!ready || visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visibleAlerts.map((alert) => {
        if (alert.type === "game") {
          return (
            <div
              key={alert.id}
              className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm"
            >
              <img src={teamLogoUrl(alert.team)} alt={alert.team} width={16} height={16} className="shrink-0" />
              <Link
                href={`/match/${alert.gameId}`}
                className="flex-1 text-text-primary hover:text-accent transition-colors"
              >
                <span className="font-semibold">Match ce soir</span>
                {" : "}
                {alert.team} vs {alert.opponent}
                {alert.time ? ` à ${alert.time}` : ""}
              </Link>
              <button
                onClick={() => setDismissed((prev) => new Set(prev).add(alert.id))}
                className="shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:bg-input hover:text-text-primary"
                aria-label="Fermer"
              >
                <X size={14} />
              </button>
            </div>
          );
        }

        return (
          <div
            key={alert.id}
            className="flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm"
          >
            <img src={teamLogoUrl(alert.team)} alt={alert.team} width={16} height={16} className="shrink-0" />
            <span className="flex-1 text-text-primary">
              <span className="font-semibold">Blessure</span>
              {" : "}
              {alert.playerName} ({alert.team})
              {" -- "}
              {alert.status}
              {alert.injuryType ? ` (${alert.injuryType})` : ""}
            </span>
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(alert.id))}
              className="shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:bg-input hover:text-text-primary"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
