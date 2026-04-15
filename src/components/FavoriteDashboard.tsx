"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFavorites } from "@/context/FavoritesContext";
import { createClient } from "@/lib/supabase/client";
import { getCurrentSeason } from "@/lib/season";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";

interface Game {
  game_id: string;
  game_date: string;
  status: number;
  status_text: string;
  home_team: string;
  home_team_name: string;
  home_score: number;
  away_team: string;
  away_team_name: string;
  away_score: number;
  game_time: string;
}

interface PlayerStats {
  player_id: number;
  first_name: string;
  last_name: string;
  team_tricode: string;
  pts: number | null;
  reb: number | null;
  ast: number | null;
}

function formatGameDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatGameTime(gameDate: string, gameTime: string): string {
  if (!gameTime) return "";
  const timePart = gameTime.includes("T") ? gameTime.split("T")[1] : gameTime;
  const match = timePart.match(/^(\d{2}):(\d{2})/);
  if (!match) return "";
  const etHours = parseInt(match[1]);
  const etMinutes = parseInt(match[2]);
  // Convert ET → Paris time (approximate: ET + 6h)
  const parisHours = (etHours + 6) % 24;
  return `${parisHours.toString().padStart(2, "0")}:${match[2]}`;
}

function TeamLogo({ tricode }: { tricode: string }) {
  const url = teamLogoUrl(tricode);
  if (!url) return <span className="inline-block h-5 w-5 shrink-0 rounded bg-input" />;
  return <img src={url} alt={tricode} width={20} height={20} className="shrink-0" />;
}

function GameCard({ game }: { game: Game }) {
  const isFinal = game.status === 3;
  const time = game.game_time ? formatGameTime(game.game_date, game.game_time) : "";
  return (
    <Link
      href={`/match/${game.game_id}`}
      className="flex items-center gap-3 rounded-xl border border-border-t bg-card px-3 py-2.5 h-14 transition-colors hover:border-border-hover"
    >
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <TeamLogo tricode={game.away_team} />
        <span className="text-sm font-semibold text-text-primary truncate">{game.away_team}</span>
      </div>
      <div className="shrink-0 text-center">
        {isFinal ? (
          <div className="text-sm font-bold text-text-primary">
            {game.away_score} - {game.home_score}
          </div>
        ) : (
          <div className="text-xs text-accent font-semibold">{time || game.status_text}</div>
        )}
        <div className="text-[10px] text-text-faint">{formatGameDate(game.game_date)}</div>
      </div>
      <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
        <span className="text-sm font-semibold text-text-primary truncate">{game.home_team}</span>
        <TeamLogo tricode={game.home_team} />
      </div>
    </Link>
  );
}

function PlayerCard({ player }: { player: PlayerStats }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-t bg-card px-3 py-2.5">
      <img
        src={playerPhotoUrl(player.player_id)}
        alt={`${player.first_name} ${player.last_name}`}
        width={30}
        height={30}
        className="shrink-0 rounded-full bg-input object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-text-primary truncate">
            {player.first_name} {player.last_name}
          </span>
          {teamLogoUrl(player.team_tricode) && <img src={teamLogoUrl(player.team_tricode)} alt={player.team_tricode} width={16} height={16} className="shrink-0" />}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <StatBox label="PTS" value={player.pts} />
        <StatBox label="REB" value={player.reb} />
        <StatBox label="AST" value={player.ast} />
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-input/50 px-2 py-1 min-w-[40px]">
      <span className="text-xs font-bold text-text-primary">{value != null ? Number(value).toFixed(1) : "-"}</span>
      <span className="text-[9px] font-semibold uppercase text-text-muted">{label}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-input/30" />
      ))}
    </div>
  );
}

export default function FavoriteDashboard() {
  const { favoriteTeams, followedPlayers, loaded } = useFavorites();
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loaded) return;
    if (favoriteTeams.length === 0 && followedPlayers.length === 0) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const season = getCurrentSeason();

    async function fetchData() {
      const promises: Promise<void>[] = [];

      if (favoriteTeams.length > 0) {
        // Recent results
        promises.push(
          (async () => {
            const { data } = await supabase
              .from("games")
              .select("game_id, game_date, status, status_text, home_team, home_team_name, home_score, away_team, away_team_name, away_score, game_time")
              .eq("status", 3)
              .or(favoriteTeams.map((t) => `home_team.eq.${t},away_team.eq.${t}`).join(","))
              .order("game_date", { ascending: false })
              .limit(4);
            setRecentGames(data || []);
          })()
        );

        // Upcoming games
        promises.push(
          (async () => {
            const { data } = await supabase
              .from("games")
              .select("game_id, game_date, status, status_text, home_team, home_team_name, home_score, away_team, away_team_name, away_score, game_time")
              .eq("status", 1)
              .or(favoriteTeams.map((t) => `home_team.eq.${t},away_team.eq.${t}`).join(","))
              .order("game_date", { ascending: true })
              .limit(4);
            setUpcomingGames(data || []);
          })()
        );
      }

      if (followedPlayers.length > 0) {
        promises.push(
          (async () => {
            const { data } = await supabase
              .from("rosters")
              .select("player_id, first_name, last_name, team_tricode, pts, reb, ast")
              .eq("season", season)
              .in("player_id", followedPlayers.slice(0, 4));
            setPlayers(data || []);
          })()
        );
      }

      await Promise.all(promises);
      setLoading(false);
    }

    fetchData();
  }, [loaded, favoriteTeams, followedPlayers]);

  if (!loaded || (favoriteTeams.length === 0 && followedPlayers.length === 0)) {
    return null;
  }

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary">Mon espace</h2>
        <p className="mt-1 text-sm text-text-muted">Vos équipes et joueurs favoris</p>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Games grid */}
          {(recentGames.length > 0 || upcomingGames.length > 0) && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Recent results */}
              {recentGames.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
                    Résultats récents
                  </h3>
                  <div className="space-y-2">
                    {recentGames.map((g) => (
                      <GameCard key={g.game_id} game={g} />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming games */}
              {upcomingGames.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
                    Prochains matchs
                  </h3>
                  <div className="space-y-2">
                    {upcomingGames.map((g) => (
                      <GameCard key={g.game_id} game={g} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Followed players */}
          {players.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
                Joueurs suivis
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {players.map((p) => (
                  <PlayerCard key={p.player_id} player={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
