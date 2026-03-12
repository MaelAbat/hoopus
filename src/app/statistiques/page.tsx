"use client";

import { useEffect, useState } from "react";
import { fetchLeaders, type PlayerStatLeader, type StatCategory } from "@/lib/nba-api";

interface LeaderBoardData {
  title: string;
  stat: StatCategory;
  unit: string;
  data: PlayerStatLeader[];
}

const BOARDS: { title: string; stat: StatCategory; unit: string }[] = [
  { title: "Points", stat: "PTS", unit: "PPG" },
  { title: "Rebonds", stat: "REB", unit: "RPG" },
  { title: "Passes", stat: "AST", unit: "APG" },
  { title: "Contres", stat: "BLK", unit: "BPG" },
  { title: "Interceptions", stat: "STL", unit: "SPG" },
  { title: "% à 3 points", stat: "FG3_PCT", unit: "%" },
];

function LeaderBoard({ title, data, unit }: { title: string; data: PlayerStatLeader[]; unit: string }) {
  return (
    <div className="rounded-2xl bg-[#111827] border border-white/5 overflow-hidden">
      <div className="border-b border-white/5 px-6 py-4">
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      <div className="divide-y divide-white/5">
        {data.map((player) => (
          <div
            key={player.rank}
            className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-white/[0.02]"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                player.rank === 1
                  ? "bg-orange-500/20 text-orange-400"
                  : "bg-white/5 text-gray-500"
              }`}
            >
              {player.rank}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-white">{player.name}</p>
              <p className="text-xs text-gray-500">{player.team}</p>
            </div>
            <span className="text-lg font-bold text-white">
              {player.value}
              <span className="ml-1 text-xs font-normal text-gray-500">{unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderBoardSkeleton() {
  return (
    <div className="rounded-2xl bg-[#111827] border border-white/5 overflow-hidden animate-pulse">
      <div className="border-b border-white/5 px-6 py-4">
        <div className="h-5 w-24 rounded bg-white/5" />
      </div>
      <div className="divide-y divide-white/5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <div className="h-7 w-7 rounded-lg bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-white/5" />
              <div className="h-3 w-12 rounded bg-white/5" />
            </div>
            <div className="h-5 w-14 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Statistiques() {
  const [boards, setBoards] = useState<LeaderBoardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const results = await Promise.all(
          BOARDS.map(async (board) => ({
            ...board,
            data: await fetchLeaders(board.stat),
          }))
        );
        setBoards(results);
        setIsLive(true);
      } catch {
        setIsLive(false);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Statistiques</h1>
        <p className="mt-1 text-gray-500">
          Leaders de la saison 2025-26
          {!loading && (
            isLive ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
                Données indisponibles
              </span>
            )
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {loading
          ? BOARDS.slice(0, 3).map((b) => <LeaderBoardSkeleton key={b.stat} />)
          : boards.slice(0, 3).map((b) => (
              <LeaderBoard key={b.stat} title={b.title} data={b.data} unit={b.unit} />
            ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {loading
          ? BOARDS.slice(3).map((b) => <LeaderBoardSkeleton key={b.stat} />)
          : boards.slice(3).map((b) => (
              <LeaderBoard key={b.stat} title={b.title} data={b.data} unit={b.unit} />
            ))}
      </div>
    </div>
  );
}
