import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Catégories qu'on peut trier directement via l'API NBA
const API_CATEGORIES = ["PTS", "REB", "AST", "BLK", "STL"] as const;
// FG3_PCT n'est pas triable via l'API, on le calcule manuellement
const SEASON = "2025-26";
const LIMIT = 10;
const MIN_FG3A = 3; // Minimum 3 tentatives à 3pts par match pour être éligible

const NBA_HEADERS: Record<string, string> = {
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

function fetchFromNba(statCategory: string): Promise<NbaStatsResponse> {
  const url = `https://stats.nba.com/stats/leagueleaders?LeagueID=00&PerMode=PerGame&Scope=S&Season=${SEASON}&SeasonType=Regular+Season&StatCategory=${statCategory}`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: NBA_HEADERS }, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`NBA API error: ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Failed to parse NBA API response"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("NBA API timeout"));
    });
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = request.nextUrl.searchParams.get("secret");

  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    secret === process.env.REVALIDATE_SECRET;

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const results: Record<string, number> = {};
  const now = new Date().toISOString();

  // Sync des catégories triables directement par l'API
  for (const category of API_CATEGORIES) {
    try {
      const data = await fetchFromNba(category);
      const headers = data.resultSet.headers;
      const rows = data.resultSet.rowSet;

      const rankIdx = headers.indexOf("RANK");
      const playerIdx = headers.indexOf("PLAYER");
      const teamIdx = headers.indexOf("TEAM");
      const statIdx = headers.indexOf(category);

      const leaders = rows.slice(0, LIMIT).map((row) => ({
        category,
        rank: Number(row[rankIdx]),
        player_name: String(row[playerIdx]),
        team: String(row[teamIdx]),
        value: Number(Number(row[statIdx]).toFixed(1)),
        season: SEASON,
        updated_at: now,
      }));

      await supabase.from("stat_leaders").delete().eq("category", category).eq("season", SEASON);
      const { error } = await supabase.from("stat_leaders").insert(leaders);
      results[category] = error ? 0 : leaders.length;
      if (error) console.error(`Error inserting ${category}:`, error);
    } catch (err) {
      console.error(`Error fetching ${category}:`, err);
      results[category] = 0;
    }
  }

  // FG3_PCT : on récupère tous les joueurs depuis PTS (qui renvoie tout le monde)
  // puis on trie manuellement par FG3_PCT avec un minimum de tentatives
  try {
    const data = await fetchFromNba("PTS");
    const headers = data.resultSet.headers;
    const rows = data.resultSet.rowSet;

    const playerIdx = headers.indexOf("PLAYER");
    const teamIdx = headers.indexOf("TEAM");
    const fg3PctIdx = headers.indexOf("FG3_PCT");
    const fg3aIdx = headers.indexOf("FG3A");

    const eligible = rows
      .filter((row) => Number(row[fg3aIdx]) >= MIN_FG3A)
      .sort((a, b) => Number(b[fg3PctIdx]) - Number(a[fg3PctIdx]))
      .slice(0, LIMIT);

    const fg3Leaders = eligible.map((row, i) => ({
      category: "FG3_PCT",
      rank: i + 1,
      player_name: String(row[playerIdx]),
      team: String(row[teamIdx]),
      value: Number((Number(row[fg3PctIdx]) * 100).toFixed(1)),
      season: SEASON,
      updated_at: now,
    }));

    await supabase.from("stat_leaders").delete().eq("category", "FG3_PCT").eq("season", SEASON);
    const { error } = await supabase.from("stat_leaders").insert(fg3Leaders);
    results["FG3_PCT"] = error ? 0 : fg3Leaders.length;
    if (error) console.error("Error inserting FG3_PCT:", error);
  } catch (err) {
    console.error("Error computing FG3_PCT:", err);
    results["FG3_PCT"] = 0;
  }

  return NextResponse.json({
    ok: true,
    synced: results,
    timestamp: new Date().toISOString(),
  });
}
