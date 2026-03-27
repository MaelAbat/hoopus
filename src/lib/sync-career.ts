import https from "node:https";
import { createClient } from "@supabase/supabase-js";

const NBA_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Encoding": "identity",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  Host: "stats.nba.com",
  Origin: "https://www.nba.com",
  Referer: "https://www.nba.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

interface NbaResponse {
  resultSets: { headers: string[]; rowSet: (string | number | null)[][] }[];
}

function fetchNba(url: string): Promise<NbaResponse> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: NBA_HEADERS }, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`NBA API error: ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(data)); } catch { reject(new Error("Parse error")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

export interface CareerSeason {
  season: string;
  team: string;
  gp: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
}

/**
 * Sync a single player's career stats from the NBA API into Supabase.
 * Returns the career data directly so the caller doesn't need to re-query.
 */
export async function syncPlayerCareer(playerId: number): Promise<CareerSeason[]> {
  try {
    const data = await fetchNba(
      `https://stats.nba.com/stats/playercareerstats?LeagueID=00&PerMode=PerGame&PlayerID=${playerId}`
    );

    const rs = data.resultSets.find((r) => r.headers.includes("SEASON_ID"));
    if (!rs || rs.rowSet.length === 0) return [];

    const h = rs.headers;
    const ii = (name: string) => h.indexOf(name);
    const now = new Date().toISOString();

    const rows = rs.rowSet.map((row) => ({
      player_id: playerId,
      season: String(row[ii("SEASON_ID")] || ""),
      team: String(row[ii("TEAM_ABBREVIATION")] || ""),
      gp: Number(row[ii("GP")] || 0),
      min: Number(row[ii("MIN")] || 0),
      pts: Number(row[ii("PTS")] || 0),
      reb: Number(row[ii("REB")] || 0),
      ast: Number(row[ii("AST")] || 0),
      stl: Number(row[ii("STL")] || 0),
      blk: Number(row[ii("BLK")] || 0),
      fg_pct: Number(row[ii("FG_PCT")] || 0),
      fg3_pct: Number(row[ii("FG3_PCT")] || 0),
      ft_pct: Number(row[ii("FT_PCT")] || 0),
      updated_at: now,
    }));

    // Persist in DB (awaited to ensure data is stored for next visit)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabase.from("player_career_stats").delete().eq("player_id", playerId);
    await supabase.from("player_career_stats").insert(rows);

    // Return data directly — no need to re-query DB
    return rows;
  } catch {
    return [];
  }
}
