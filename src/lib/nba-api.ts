const NBA_STATS_BASE = "https://stats.nba.com/stats";

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nba.com",
  Referer: "https://www.nba.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

interface NbaStatsResponse {
  resultSet: {
    headers: string[];
    rowSet: (string | number)[][];
  };
}

export interface PlayerStatLeader {
  rank: number;
  name: string;
  team: string;
  value: string;
}

async function fetchNbaStats(endpoint: string, params: Record<string, string>): Promise<NbaStatsResponse> {
  const url = new URL(`${NBA_STATS_BASE}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: HEADERS,
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`NBA API error: ${res.status}`);
  }

  return res.json();
}

export async function getLeagueLeaders(
  statCategory: "PTS" | "REB" | "AST",
  season: string = "2024-25",
  limit: number = 5
): Promise<PlayerStatLeader[]> {
  const data = await fetchNbaStats("leagueleaders", {
    LeagueID: "00",
    PerMode: "PerGame",
    Scope: "S",
    Season: season,
    SeasonType: "Regular Season",
    StatCategory: statCategory,
  });

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
    value: Number(row[statIdx]).toFixed(1),
  }));
}
