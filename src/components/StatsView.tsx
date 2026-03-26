"use client";

import { useState } from "react";
import { LayoutGrid, Table2, User, Users, TrendingUp } from "lucide-react";
import StatsCarousel from "./StatsCarousel";
import StatsTable from "./StatsTable";
import AdvancedStatsTable from "./AdvancedStatsTable";
import TeamStatsTable from "./TeamStatsTable";
import type { PlayerStatLeader } from "@/lib/nba-api";
import type { PlayerRow } from "./StatsTable";
import type { TeamRow } from "./TeamStatsTable";

interface Board {
  title: string;
  stat: string;
  unit: string;
  top10: PlayerStatLeader[];
  full: PlayerStatLeader[];
  eligibleCount: number;
}

type Section = "players" | "teams";
type PlayerView = "carousel" | "table" | "advanced";

export default function StatsView({
  boards,
  tableData,
  teamData,
}: {
  boards: Board[];
  tableData: PlayerRow[];
  teamData: TeamRow[];
}) {
  const [section, setSection] = useState<Section>("players");
  const [playerView, setPlayerView] = useState<PlayerView>("carousel");

  return (
    <div className="space-y-6">
      {/* Main section tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex rounded-xl bg-card border border-border-t p-1">
          <button
            onClick={() => setSection("players")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              section === "players"
                ? "bg-accent text-white shadow-md"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <User size={16} />
            Joueurs
          </button>
          <button
            onClick={() => setSection("teams")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              section === "teams"
                ? "bg-accent text-white shadow-md"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Users size={16} />
            Equipes
          </button>
        </div>

        {/* Player sub-tabs */}
        {section === "players" && (
          <div className="flex rounded-lg bg-input p-0.5 overflow-x-auto">
            <button
              onClick={() => setPlayerView("carousel")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                playerView === "carousel"
                  ? "bg-card text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <LayoutGrid size={13} />
              Par categorie
            </button>
            <button
              onClick={() => setPlayerView("table")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                playerView === "table"
                  ? "bg-card text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <Table2 size={13} />
              Feuille de stats
            </button>
            <button
              onClick={() => setPlayerView("advanced")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                playerView === "advanced"
                  ? "bg-card text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <TrendingUp size={13} />
              Stats avancees
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {section === "players" && playerView === "carousel" && <StatsCarousel boards={boards} />}
      {section === "players" && playerView === "table" && <StatsTable players={tableData} />}
      {section === "players" && playerView === "advanced" && <AdvancedStatsTable players={tableData} />}
      {section === "teams" && <TeamStatsTable teams={teamData} />}
    </div>
  );
}
