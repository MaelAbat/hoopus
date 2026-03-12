export interface PlayerStatLeader {
  rank: number;
  name: string;
  team: string;
  value: string;
}

export type StatCategory = "PTS" | "REB" | "AST" | "BLK" | "STL" | "FG3_PCT";

interface NbaStatsResponse {
  resultSet: {
    headers: string[];
    rowSet: (string | number)[][];
  };
}

export async function fetchLeaders(
  statCategory: StatCategory,
  season: string = "2025-26",
  limit: number = 5
): Promise<PlayerStatLeader[]> {
  const res = await fetch(`/api/nba-stats?stat=${statCategory}&season=${season}`);

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const data: NbaStatsResponse = await res.json();
  const headers = data.resultSet.headers;
  const rows = data.resultSet.rowSet;

  const rankIdx = headers.indexOf("RANK");
  const playerIdx = headers.indexOf("PLAYER");
  const teamIdx = headers.indexOf("TEAM");
  const statIdx = headers.indexOf(statCategory);

  return rows.slice(0, limit).map((row) => ({
    rank: Number(row[rankIdx]),
    name: String(row[playerIdx]),
    team: String(row[teamIdx]),
    value: statCategory === "FG3_PCT"
      ? (Number(row[statIdx]) * 100).toFixed(1)
      : Number(row[statIdx]).toFixed(1),
  }));
}
