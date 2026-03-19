import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Catégories triables directement via l'API NBA
const API_CATEGORIES = ["PTS", "REB", "AST", "BLK", "STL", "EFF", "TOV"] as const;

const SEASON = "2025-26";
const MIN_FG3A = 3;   // Min 3 tentatives 3pts/match
const MIN_FGA = 8;     // Min 8 tentatives tir/match
const MIN_FTA = 2;     // Min 2 lancers francs/match
const MIN_FG2A = 4;    // Min 4 tentatives 2pts/match
const BATCH_SIZE = 200;

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

interface LeaderRow {
  category: string;
  rank: number;
  player_name: string;
  team: string;
  value: number;
  season: string;
  updated_at: string;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function batchInsert(
  supabase: any,
  rows: LeaderRow[]
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("stat_leaders").insert(batch as any);
    if (error) {
      console.error(`Batch insert error at ${i}:`, error);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
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

  // --- Catégories triables directement (tous les joueurs) ---
  for (const category of API_CATEGORIES) {
    try {
      const data = await fetchFromNba(category);
      const headers = data.resultSet.headers;
      const rows = data.resultSet.rowSet;

      const rankIdx = headers.indexOf("RANK");
      const playerIdx = headers.indexOf("PLAYER");
      const teamIdx = headers.indexOf("TEAM");
      const statIdx = headers.indexOf(category);

      const leaders: LeaderRow[] = rows.map((row) => ({
        category,
        rank: Number(row[rankIdx]),
        player_name: String(row[playerIdx]),
        team: String(row[teamIdx]),
        value: Number(Number(row[statIdx]).toFixed(1)),
        season: SEASON,
        updated_at: now,
      }));

      await supabase.from("stat_leaders").delete().eq("category", category).eq("season", SEASON);
      results[category] = await batchInsert(supabase, leaders);
    } catch (err) {
      console.error(`Error fetching ${category}:`, err);
      results[category] = 0;
    }
  }

  // --- Catégories calculées manuellement à partir des données brutes ---
  try {
    const data = await fetchFromNba("PTS");
    const headers = data.resultSet.headers;
    const rows = data.resultSet.rowSet;

    const playerIdx = headers.indexOf("PLAYER");
    const teamIdx = headers.indexOf("TEAM");
    const ptsIdx = headers.indexOf("PTS");
    const fgaIdx = headers.indexOf("FGA");
    const fgmIdx = headers.indexOf("FGM");
    const fg3mIdx = headers.indexOf("FG3M");
    const fg3aIdx = headers.indexOf("FG3A");
    const fg3PctIdx = headers.indexOf("FG3_PCT");
    const ftaIdx = headers.indexOf("FTA");
    const fgPctIdx = headers.indexOf("FG_PCT");
    const ftPctIdx = headers.indexOf("FT_PCT");

    // Helper to build leaders from sorted eligible rows
    function buildLeaders(
      category: string,
      eligible: { row: (string | number)[]; val: number }[]
    ): LeaderRow[] {
      return eligible.map(({ row, val }, i) => ({
        category,
        rank: i + 1,
        player_name: String(row[playerIdx]),
        team: String(row[teamIdx]),
        value: Number(val.toFixed(1)),
        season: SEASON,
        updated_at: now,
      }));
    }

    // FG3_PCT — % à 3 points (min tentatives)
    const fg3Leaders = buildLeaders(
      "FG3_PCT",
      rows
        .filter((row) => Number(row[fg3aIdx]) >= MIN_FG3A)
        .map((row) => ({ row, val: Number(row[fg3PctIdx]) * 100 }))
        .sort((a, b) => b.val - a.val)
    );
    await supabase.from("stat_leaders").delete().eq("category", "FG3_PCT").eq("season", SEASON);
    results["FG3_PCT"] = await batchInsert(supabase, fg3Leaders);

    // FG2_PCT — % à 2 points (calculé : (FGM - FG3M) / (FGA - FG3A))
    const fg2Leaders = buildLeaders(
      "FG2_PCT",
      rows
        .filter((row) => (Number(row[fgaIdx]) - Number(row[fg3aIdx])) >= MIN_FG2A)
        .map((row) => {
          const fg2m = Number(row[fgmIdx]) - Number(row[fg3mIdx]);
          const fg2a = Number(row[fgaIdx]) - Number(row[fg3aIdx]);
          return { row, val: fg2a > 0 ? (fg2m / fg2a) * 100 : 0 };
        })
        .sort((a, b) => b.val - a.val)
    );
    await supabase.from("stat_leaders").delete().eq("category", "FG2_PCT").eq("season", SEASON);
    results["FG2_PCT"] = await batchInsert(supabase, fg2Leaders);

    // TS_PCT — True Shooting %
    const tsLeaders = buildLeaders(
      "TS_PCT",
      rows
        .filter((row) => Number(row[fgaIdx]) >= MIN_FGA)
        .map((row) => {
          const pts = Number(row[ptsIdx]);
          const fga = Number(row[fgaIdx]);
          const fta = Number(row[ftaIdx]);
          return { row, val: (pts / (2 * (fga + 0.44 * fta))) * 100 };
        })
        .sort((a, b) => b.val - a.val)
    );
    await supabase.from("stat_leaders").delete().eq("category", "TS_PCT").eq("season", SEASON);
    results["TS_PCT"] = await batchInsert(supabase, tsLeaders);

    // FG_PCT — % au tir global
    const fgLeaders = buildLeaders(
      "FG_PCT",
      rows
        .filter((row) => Number(row[fgaIdx]) >= MIN_FGA)
        .map((row) => ({ row, val: Number(row[fgPctIdx]) * 100 }))
        .sort((a, b) => b.val - a.val)
    );
    await supabase.from("stat_leaders").delete().eq("category", "FG_PCT").eq("season", SEASON);
    results["FG_PCT"] = await batchInsert(supabase, fgLeaders);

    // FT_PCT — % aux lancers francs
    const ftLeaders = buildLeaders(
      "FT_PCT",
      rows
        .filter((row) => Number(row[ftaIdx]) >= MIN_FTA)
        .map((row) => ({ row, val: Number(row[ftPctIdx]) * 100 }))
        .sort((a, b) => b.val - a.val)
    );
    await supabase.from("stat_leaders").delete().eq("category", "FT_PCT").eq("season", SEASON);
    results["FT_PCT"] = await batchInsert(supabase, ftLeaders);
  } catch (err) {
    console.error("Error computing manual stats:", err);
    results["FG3_PCT"] = results["FG3_PCT"] || 0;
    results["FG2_PCT"] = 0;
    results["TS_PCT"] = 0;
    results["FG_PCT"] = 0;
    results["FT_PCT"] = 0;
  }

  return NextResponse.json({
    ok: true,
    synced: results,
    timestamp: new Date().toISOString(),
  });
}
