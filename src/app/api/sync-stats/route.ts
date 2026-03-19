import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";
const BATCH_SIZE = 200;
const MIN_FG3A = 3;
const MIN_FGA = 8;
const MIN_FTA = 2;
const MIN_FG2A = 4;

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

interface NbaDashResponse {
  resultSets: {
    headers: string[];
    rowSet: (string | number)[][];
  }[];
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

// Categories mapped from stat field → rank field in the API response
const DIRECT_CATEGORIES: { category: string; statField: string; rankField: string }[] = [
  { category: "PTS", statField: "PTS", rankField: "PTS_RANK" },
  { category: "REB", statField: "REB", rankField: "REB_RANK" },
  { category: "AST", statField: "AST", rankField: "AST_RANK" },
  { category: "BLK", statField: "BLK", rankField: "BLK_RANK" },
  { category: "STL", statField: "STL", rankField: "STL_RANK" },
  { category: "EFF", statField: "NBA_FANTASY_PTS", rankField: "NBA_FANTASY_PTS_RANK" },
  { category: "TOV", statField: "TOV", rankField: "TOV_RANK" },
];

function fetchAllPlayers(): Promise<NbaDashResponse> {
  const url =
    "https://stats.nba.com/stats/leaguedashplayerstats?" +
    "Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&ISTRound=" +
    "&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0" +
    "&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=" +
    "&PlayerPosition=&PlusMinus=N&Rank=N&Season=" + SEASON +
    "&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=" +
    "&TeamID=0&TwoWay=0&VsConference=&VsDivision=&Weight=";

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
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error("NBA API timeout"));
    });
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function batchInsert(supabase: any, rows: LeaderRow[]): Promise<number> {
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

  try {
    const data = await fetchAllPlayers();
    const headers = data.resultSets[0].headers;
    const rows = data.resultSets[0].rowSet;

    const idx = (name: string) => headers.indexOf(name);
    const playerIdx = idx("PLAYER_NAME");
    const teamIdx = idx("TEAM_ABBREVIATION");
    const ptsIdx = idx("PTS");
    const fgaIdx = idx("FGA");
    const fgmIdx = idx("FGM");
    const fg3mIdx = idx("FG3M");
    const fg3aIdx = idx("FG3A");
    const fg3PctIdx = idx("FG3_PCT");
    const ftaIdx = idx("FTA");
    const fgPctIdx = idx("FG_PCT");
    const ftPctIdx = idx("FT_PCT");

    // --- Direct categories (sorted by rank from API) ---
    for (const { category, statField, rankField } of DIRECT_CATEGORIES) {
      const si = idx(statField);
      const ri = idx(rankField);

      const leaders: LeaderRow[] = rows
        .map((row) => ({
          category,
          rank: Number(row[ri]),
          player_name: String(row[playerIdx]),
          team: String(row[teamIdx]),
          value: Number(Number(row[si]).toFixed(1)),
          season: SEASON,
          updated_at: now,
        }))
        .sort((a, b) => a.rank - b.rank);

      await supabase.from("stat_leaders").delete().eq("category", category).eq("season", SEASON);
      results[category] = await batchInsert(supabase, leaders);
    }

    // --- Calculated categories (manual sort + rank) ---
    function buildLeaders(
      category: string,
      eligible: { row: (string | number)[]; val: number }[]
    ): LeaderRow[] {
      return eligible
        .sort((a, b) => b.val - a.val)
        .map(({ row, val }, i) => ({
          category,
          rank: i + 1,
          player_name: String(row[playerIdx]),
          team: String(row[teamIdx]),
          value: Number(val.toFixed(1)),
          season: SEASON,
          updated_at: now,
        }));
    }

    // FG3_PCT
    const fg3Leaders = buildLeaders(
      "FG3_PCT",
      rows
        .filter((r) => Number(r[fg3aIdx]) >= MIN_FG3A)
        .map((r) => ({ row: r, val: Number(r[fg3PctIdx]) * 100 }))
    );
    await supabase.from("stat_leaders").delete().eq("category", "FG3_PCT").eq("season", SEASON);
    results["FG3_PCT"] = await batchInsert(supabase, fg3Leaders);

    // FG2_PCT
    const fg2Leaders = buildLeaders(
      "FG2_PCT",
      rows
        .filter((r) => Number(r[fgaIdx]) - Number(r[fg3aIdx]) >= MIN_FG2A)
        .map((r) => {
          const fg2m = Number(r[fgmIdx]) - Number(r[fg3mIdx]);
          const fg2a = Number(r[fgaIdx]) - Number(r[fg3aIdx]);
          return { row: r, val: fg2a > 0 ? (fg2m / fg2a) * 100 : 0 };
        })
    );
    await supabase.from("stat_leaders").delete().eq("category", "FG2_PCT").eq("season", SEASON);
    results["FG2_PCT"] = await batchInsert(supabase, fg2Leaders);

    // TS_PCT
    const tsLeaders = buildLeaders(
      "TS_PCT",
      rows
        .filter((r) => Number(r[fgaIdx]) >= MIN_FGA)
        .map((r) => {
          const pts = Number(r[ptsIdx]);
          const fga = Number(r[fgaIdx]);
          const fta = Number(r[ftaIdx]);
          return { row: r, val: (pts / (2 * (fga + 0.44 * fta))) * 100 };
        })
    );
    await supabase.from("stat_leaders").delete().eq("category", "TS_PCT").eq("season", SEASON);
    results["TS_PCT"] = await batchInsert(supabase, tsLeaders);

    // FG_PCT
    const fgLeaders = buildLeaders(
      "FG_PCT",
      rows
        .filter((r) => Number(r[fgaIdx]) >= MIN_FGA)
        .map((r) => ({ row: r, val: Number(r[fgPctIdx]) * 100 }))
    );
    await supabase.from("stat_leaders").delete().eq("category", "FG_PCT").eq("season", SEASON);
    results["FG_PCT"] = await batchInsert(supabase, fgLeaders);

    // FT_PCT
    const ftLeaders = buildLeaders(
      "FT_PCT",
      rows
        .filter((r) => Number(r[ftaIdx]) >= MIN_FTA)
        .map((r) => ({ row: r, val: Number(r[ftPctIdx]) * 100 }))
    );
    await supabase.from("stat_leaders").delete().eq("category", "FT_PCT").eq("season", SEASON);
    results["FT_PCT"] = await batchInsert(supabase, ftLeaders);
  } catch (err) {
    console.error("Error syncing stats:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    synced: results,
    timestamp: new Date().toISOString(),
  });
}
