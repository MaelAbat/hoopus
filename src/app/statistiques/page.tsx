import { createClient } from "@/lib/supabase/server";
import type { PlayerStatLeader, StatCategory } from "@/lib/nba-api";

interface BoardConfig {
  title: string;
  stat: StatCategory;
  unit: string;
}

const BOARDS: BoardConfig[] = [
  { title: "Points", stat: "PTS", unit: "PPG" },
  { title: "Rebonds", stat: "REB", unit: "RPG" },
  { title: "Passes", stat: "AST", unit: "APG" },
  { title: "Contres", stat: "BLK", unit: "BPG" },
  { title: "Interceptions", stat: "STL", unit: "SPG" },
  { title: "% à 3 points", stat: "FG3_PCT", unit: "%" },
];

function LeaderBoard({ title, data, unit }: { title: string; data: PlayerStatLeader[]; unit: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
      <div className="border-b border-border-t px-6 py-4">
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      </div>
      {data.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-text-muted">
          Aucune donnée disponible
        </div>
      ) : (
        <div className="divide-y divide-border-t">
          {data.map((player) => (
            <div
              key={`${player.rank}-${player.name}`}
              className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-card-hover"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  player.rank === 1
                    ? "bg-accent-light text-accent-text"
                    : "bg-input text-text-muted"
                }`}
              >
                {player.rank}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-text-primary">{player.name}</p>
                <p className="text-xs text-text-muted">{player.team}</p>
              </div>
              <span className="text-lg font-bold text-text-primary">
                {player.value}
                <span className="ml-1 text-xs font-normal text-text-muted">{unit}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function Statistiques() {
  const supabase = await createClient();

  const { data: allLeaders, error } = await supabase
    .from("stat_leaders")
    .select("*")
    .eq("season", "2025-26")
    .order("rank", { ascending: true });

  const hasData = !error && allLeaders && allLeaders.length > 0;

  const lastUpdate = hasData
    ? new Date(allLeaders[0].updated_at).toLocaleString("fr-FR", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  function getLeaders(category: StatCategory): PlayerStatLeader[] {
    if (!hasData) return [];
    return allLeaders
      .filter((row) => row.category === category)
      .map((row) => ({
        rank: row.rank,
        name: row.player_name,
        team: row.team,
        value: String(row.value),
      }));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Statistiques</h1>
        <p className="mt-1 text-text-muted">
          Leaders de la saison 2025-26
          {hasData ? (
            <span className="ml-2 text-xs text-text-faint">
              Mis à jour le {lastUpdate}
            </span>
          ) : (
            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
              Synchronisation requise
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {BOARDS.slice(0, 3).map((b) => (
          <LeaderBoard key={b.stat} title={b.title} data={getLeaders(b.stat)} unit={b.unit} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {BOARDS.slice(3).map((b) => (
          <LeaderBoard key={b.stat} title={b.title} data={getLeaders(b.stat)} unit={b.unit} />
        ))}
      </div>
    </div>
  );
}
