import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";
const BATCH_SIZE = 200;
const MIN_GP = 40;    // Min matchs joués pour catégories directes
const MIN_FG3A = 3;   // Min 3 tentatives 3pts/match
const MIN_FGA = 8;     // Min 8 tentatives tir/match
const MIN_FTA = 2;     // Min 2 lancers francs/match
const MIN_FG2A = 4;    // Min 4 tentatives 2pts/match

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

const DIRECT_CATEGORIES: { category: string; statField: string }[] = [
  { category: "PTS", statField: "PTS" },
  { category: "REB", statField: "REB" },
  { category: "AST", statField: "AST" },
  { category: "BLK", statField: "BLK" },
  { category: "STL", statField: "STL" },
  { category: "EFF", statField: "NBA_FANTASY_PTS" },
  { category: "TOV", statField: "TOV" },
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
    const gpIdx = idx("GP");
    const ptsIdx = idx("PTS");
    const fgaIdx = idx("FGA");
    const fgmIdx = idx("FGM");
    const fg3mIdx = idx("FG3M");
    const fg3aIdx = idx("FG3A");
    const fg3PctIdx = idx("FG3_PCT");
    const ftaIdx = idx("FTA");
    const fgPctIdx = idx("FG_PCT");
    const ftPctIdx = idx("FT_PCT");

    // Eligible players get rank 1..N, ineligible get N+1..M
    // A metadata row (rank=0) stores the eligible count in `value`
    function buildLeadersWithEligibility(
      category: string,
      allPlayers: { row: (string | number)[]; val: number; eligible: boolean }[]
    ): LeaderRow[] {
      const eligible = allPlayers.filter((p) => p.eligible).sort((a, b) => b.val - a.val);
      const ineligible = allPlayers.filter((p) => !p.eligible).sort((a, b) => b.val - a.val);
      const eligibleCount = eligible.length;

      const leaders: LeaderRow[] = [];

      // Metadata row: rank=0, value=eligible count
      leaders.push({
        category,
        rank: 0,
        player_name: "__eligible_count__",
        team: "",
        value: eligibleCount,
        season: SEASON,
        updated_at: now,
      });

      // Eligible players: rank 1..N
      eligible.forEach(({ row, val }, i) => {
        leaders.push({
          category,
          rank: i + 1,
          player_name: String(row[playerIdx]),
          team: String(row[teamIdx]),
          value: Math.round(val * 100) / 100,
          season: SEASON,
          updated_at: now,
        });
      });

      // Ineligible players: rank N+1..M
      ineligible.forEach(({ row, val }, i) => {
        leaders.push({
          category,
          rank: eligibleCount + i + 1,
          player_name: String(row[playerIdx]),
          team: String(row[teamIdx]),
          value: Math.round(val * 100) / 100,
          season: SEASON,
          updated_at: now,
        });
      });

      return leaders;
    }

    // --- Direct categories (eligible = GP >= MIN_GP) ---
    for (const { category, statField } of DIRECT_CATEGORIES) {
      const si = idx(statField);

      const allPlayers = rows.map((row) => ({
        row,
        val: Math.round(Number(row[si]) * 100) / 100,
        eligible: Number(row[gpIdx]) >= MIN_GP,
      }));

      const leaders = buildLeadersWithEligibility(category, allPlayers);
      await supabase.from("stat_leaders").delete().eq("category", category).eq("season", SEASON);
      results[category] = await batchInsert(supabase, leaders);
    }

    // --- Calculated categories ---
    // FG3_PCT — all players with FG3 attempts, eligible if FG3A >= MIN_FG3A
    const fg3All = rows
      .filter((r) => Number(r[fg3aIdx]) > 0)
      .map((r) => ({
        row: r,
        val: Number(r[fg3PctIdx]) * 100,
        eligible: Number(r[fg3aIdx]) >= MIN_FG3A,
      }));
    const fg3Leaders = buildLeadersWithEligibility("FG3_PCT", fg3All);
    await supabase.from("stat_leaders").delete().eq("category", "FG3_PCT").eq("season", SEASON);
    results["FG3_PCT"] = await batchInsert(supabase, fg3Leaders);

    // FG2_PCT — all players with FG2 attempts
    const fg2All = rows
      .filter((r) => Number(r[fgaIdx]) - Number(r[fg3aIdx]) > 0)
      .map((r) => {
        const fg2m = Number(r[fgmIdx]) - Number(r[fg3mIdx]);
        const fg2a = Number(r[fgaIdx]) - Number(r[fg3aIdx]);
        return { row: r, val: fg2a > 0 ? (fg2m / fg2a) * 100 : 0, eligible: fg2a >= MIN_FG2A };
      });
    const fg2Leaders = buildLeadersWithEligibility("FG2_PCT", fg2All);
    await supabase.from("stat_leaders").delete().eq("category", "FG2_PCT").eq("season", SEASON);
    results["FG2_PCT"] = await batchInsert(supabase, fg2Leaders);

    // TS_PCT — all players with FGA > 0
    const tsAll = rows
      .filter((r) => Number(r[fgaIdx]) > 0)
      .map((r) => {
        const pts = Number(r[ptsIdx]);
        const fga = Number(r[fgaIdx]);
        const fta = Number(r[ftaIdx]);
        return { row: r, val: (pts / (2 * (fga + 0.44 * fta))) * 100, eligible: fga >= MIN_FGA };
      });
    const tsLeaders = buildLeadersWithEligibility("TS_PCT", tsAll);
    await supabase.from("stat_leaders").delete().eq("category", "TS_PCT").eq("season", SEASON);
    results["TS_PCT"] = await batchInsert(supabase, tsLeaders);

    // FG_PCT — all players with FGA > 0
    const fgAll = rows
      .filter((r) => Number(r[fgaIdx]) > 0)
      .map((r) => ({
        row: r,
        val: Number(r[fgPctIdx]) * 100,
        eligible: Number(r[fgaIdx]) >= MIN_FGA,
      }));
    const fgLeaders = buildLeadersWithEligibility("FG_PCT", fgAll);
    await supabase.from("stat_leaders").delete().eq("category", "FG_PCT").eq("season", SEASON);
    results["FG_PCT"] = await batchInsert(supabase, fgLeaders);

    // FT_PCT — all players with FTA > 0
    const ftAll = rows
      .filter((r) => Number(r[ftaIdx]) > 0)
      .map((r) => ({
        row: r,
        val: Number(r[ftPctIdx]) * 100,
        eligible: Number(r[ftaIdx]) >= MIN_FTA,
      }));
    const ftLeaders = buildLeadersWithEligibility("FT_PCT", ftAll);
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
