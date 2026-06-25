"use client";

import { Star, Heart, X } from "lucide-react";
import Link from "next/link";
import { useFavorites } from "@/context/FavoritesContext";
import { teamLogoUrl, playerPhotoUrl, ACTIVE_TEAM_IDS } from "@/lib/nba-teams";

const TEAM_NAMES: Record<string, string> = {
  ATL: "Hawks", BOS: "Celtics", BKN: "Nets", CHA: "Hornets",
  CHI: "Bulls", CLE: "Cavaliers", DAL: "Mavericks", DEN: "Nuggets",
  DET: "Pistons", GSW: "Warriors", HOU: "Rockets", IND: "Pacers",
  LAC: "Clippers", LAL: "Lakers", MEM: "Grizzlies", MIA: "Heat",
  MIL: "Bucks", MIN: "Timberwolves", NOP: "Pelicans", NYK: "Knicks",
  OKC: "Thunder", ORL: "Magic", PHI: "76ers", PHX: "Suns",
  POR: "Trail Blazers", SAC: "Kings", SAS: "Spurs", TOR: "Raptors",
  UTA: "Jazz", WAS: "Wizards",
};

interface Player {
  player_id: number;
  first_name: string;
  last_name: string;
  team_tricode: string | null;
  position: string | null;
}

export default function ProfileFavorites({ allPlayers }: { allPlayers: Player[] }) {
  const { favoriteTeams, followedPlayers, toggleTeam, togglePlayer } = useFavorites();

  const allTeams = Object.entries(ACTIVE_TEAM_IDS)
    .map(([tri]) => tri)
    .sort((a, b) => (TEAM_NAMES[a] || a).localeCompare(TEAM_NAMES[b] || b));

  const followedPlayerData = allPlayers.filter((p) => followedPlayers.includes(p.player_id));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Favourite teams */}
      <div className="border border-rule bg-card overflow-hidden">
        <div className="border-b border-rule px-6 py-4">
          <h3 className="kicker flex items-center gap-2 text-text-faint">
            <Star size={14} className="text-accent" />
            Équipes favorites
          </h3>
        </div>

        {favoriteTeams.length > 0 ? (
          <div className="divide-y divide-rule">
            {favoriteTeams.map((tri) => (
              <div key={tri} className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-card-hover">
                <img src={teamLogoUrl(tri)} alt={tri} className="h-6 w-6 object-contain" />
                <span className="flex-1 text-sm font-semibold uppercase tracking-wide text-text-primary">{TEAM_NAMES[tri] || tri}</span>
                <button onClick={() => toggleTeam(tri)} className="p-1 text-text-faint transition-colors hover:bg-input hover:text-text-primary">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-6 py-4 text-sm text-text-faint">Aucune équipe favorite</p>
        )}

        {/* Add teams */}
        <div className="border-t border-rule px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {allTeams.filter((t) => !favoriteTeams.includes(t)).map((tri) => (
              <button
                key={tri}
                onClick={() => toggleTeam(tri)}
                className="flex items-center gap-1.5 border border-rule px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:bg-input hover:text-text-primary"
              >
                <img src={teamLogoUrl(tri)} alt={tri} className="h-3.5 w-3.5 object-contain" />
                {tri}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Followed players */}
      <div className="border border-rule bg-card overflow-hidden">
        <div className="border-b border-rule px-6 py-4">
          <h3 className="kicker flex items-center gap-2 text-text-faint">
            <Heart size={14} className="text-accent" />
            Joueurs suivis
          </h3>
        </div>

        {followedPlayerData.length > 0 ? (
          <div className="divide-y divide-rule">
            {followedPlayerData.map((p) => (
              <div key={p.player_id} className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-card-hover">
                <img
                  src={playerPhotoUrl(p.player_id)}
                  alt=""
                  className="h-8 w-8 object-cover bg-input"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <Link href={`/joueurs/${p.player_id}`} className="flex-1 min-w-0 transition-colors hover:text-accent">
                  <p className="text-sm font-semibold text-text-primary truncate">{p.first_name} {p.last_name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{p.team_tricode} {p.position ? `· ${p.position}` : ""}</p>
                </Link>
                <button onClick={() => togglePlayer(p.player_id)} className="p-1 text-text-faint transition-colors hover:bg-input hover:text-text-primary">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-6 py-4 text-sm text-text-faint">Aucun joueur suivi</p>
        )}

        {followedPlayerData.length === 0 && (
          <div className="border-t border-rule px-6 py-4">
            <p className="text-xs text-text-faint">
              Visitez la page d&apos;un joueur et cliquez sur &quot;Suivre&quot; pour le retrouver ici.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
