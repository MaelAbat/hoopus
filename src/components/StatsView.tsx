"use client";

import { useState } from "react";
import { LayoutGrid, Table2, Users } from "lucide-react";
import StatsCarousel from "./StatsCarousel";
import StatsTable from "./StatsTable";
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

type ViewMode = "carousel" | "table" | "teams";

export default function StatsView({
  boards,
  tableData,
  teamData,
}: {
  boards: Board[];
  tableData: PlayerRow[];
  teamData: TeamRow[];
}) {
  const [view, setView] = useState<ViewMode>("carousel");

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex rounded-lg bg-card border border-border-t p-1 w-fit">
        <button
          onClick={() => setView("carousel")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
            view === "carousel"
              ? "bg-accent text-white shadow-sm"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <LayoutGrid size={15} />
          Par catégorie
        </button>
        <button
          onClick={() => setView("table")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
            view === "table"
              ? "bg-accent text-white shadow-sm"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <Table2 size={15} />
          Feuille de stats
        </button>
        <button
          onClick={() => setView("teams")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
            view === "teams"
              ? "bg-accent text-white shadow-sm"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <Users size={15} />
          Équipes
        </button>
      </div>

      {view === "carousel" && <StatsCarousel boards={boards} />}
      {view === "table" && <StatsTable players={tableData} />}
      {view === "teams" && <TeamStatsTable teams={teamData} />}
    </div>
  );
}
