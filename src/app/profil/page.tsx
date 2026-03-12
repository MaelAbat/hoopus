import { Star, Bell, Settings, TrendingUp } from "lucide-react";

const favoriteTeams = ["Los Angeles Lakers", "San Antonio Spurs", "Boston Celtics"];

const favoritePlayers = [
  { name: "Victor Wembanyama", team: "SAS", position: "C" },
  { name: "Luka Doncic", team: "DAL", position: "PG" },
  { name: "Jayson Tatum", team: "BOS", position: "SF" },
];

export default function Profil() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Profil</h1>
        <p className="mt-1 text-gray-500">Gérez vos préférences et vos favoris</p>
      </div>

      {/* User card */}
      <div className="flex items-center gap-6 rounded-2xl bg-[#111827] border border-white/5 p-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-3xl font-bold text-white shadow-lg shadow-orange-500/20">
          U
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Utilisateur</h2>
          <p className="text-gray-500">Membre depuis mars 2026</p>
          <div className="mt-2 flex gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-400">
              <Star size={12} /> Fan NBA
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Favorite teams */}
        <div className="rounded-2xl bg-[#111827] border border-white/5 overflow-hidden">
          <div className="border-b border-white/5 px-6 py-4">
            <h3 className="flex items-center gap-2 font-bold text-white">
              <Star size={16} className="text-orange-500" />
              Équipes favorites
            </h3>
          </div>
          <div className="divide-y divide-white/5">
            {favoriteTeams.map((team) => (
              <div key={team} className="px-6 py-4 text-sm text-gray-300 transition-colors hover:bg-white/[0.02]">
                {team}
              </div>
            ))}
          </div>
        </div>

        {/* Favorite players */}
        <div className="rounded-2xl bg-[#111827] border border-white/5 overflow-hidden">
          <div className="border-b border-white/5 px-6 py-4">
            <h3 className="flex items-center gap-2 font-bold text-white">
              <TrendingUp size={16} className="text-orange-500" />
              Joueurs suivis
            </h3>
          </div>
          <div className="divide-y divide-white/5">
            {favoritePlayers.map((player) => (
              <div key={player.name} className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-white/[0.02]">
                <span className="text-sm font-medium text-gray-300">{player.name}</span>
                <span className="text-xs text-gray-500">{player.team} · {player.position}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Settings shortcuts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button className="flex items-center gap-3 rounded-2xl bg-[#111827] border border-white/5 px-6 py-4 text-left transition-all duration-200 hover:border-orange-500/20 hover:shadow-lg hover:shadow-orange-500/5">
          <Bell size={18} className="text-gray-500" />
          <div>
            <p className="text-sm font-semibold text-white">Notifications</p>
            <p className="text-xs text-gray-500">Gérer les alertes</p>
          </div>
        </button>
        <button className="flex items-center gap-3 rounded-2xl bg-[#111827] border border-white/5 px-6 py-4 text-left transition-all duration-200 hover:border-orange-500/20 hover:shadow-lg hover:shadow-orange-500/5">
          <Settings size={18} className="text-gray-500" />
          <div>
            <p className="text-sm font-semibold text-white">Paramètres</p>
            <p className="text-xs text-gray-500">Préférences du compte</p>
          </div>
        </button>
      </div>
    </div>
  );
}
