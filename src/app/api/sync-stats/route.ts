import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const CATEGORIES = ["PTS", "REB", "AST", "BLK", "STL", "FG3_PCT"] as const;
const SEASON = "2025-26";
const LIMIT = 10;

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

  for (const category of CATEGORIES) {
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
        value: category === "FG3_PCT"
          ? Number((Number(row[statIdx]) * 100).toFixed(1))
          : Number(Number(row[statIdx]).toFixed(1)),
        season: SEASON,
        updated_at: new Date().toISOString(),
      }));

      // Delete old data for this category then insert fresh
      await supabase
        .from("stat_leaders")
        .delete()
        .eq("category", category)
        .eq("season", SEASON);

      const { error } = await supabase.from("stat_leaders").insert(leaders);

      if (error) {
        console.error(`Error inserting ${category}:`, error);
        results[category] = 0;
      } else {
        results[category] = leaders.length;
      }
    } catch (err) {
      console.error(`Error fetching ${category}:`, err);
      results[category] = 0;
    }
  }

  return NextResponse.json({
    ok: true,
    synced: results,
    timestamp: new Date().toISOString(),
  });
}
