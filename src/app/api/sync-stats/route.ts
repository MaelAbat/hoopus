import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";
const BATCH_SIZE = 200;
const MIN_GP = 40;
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
  player_id: number;
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
  { category: "MIN", statField: "MIN" },
  { category: "OREB", statField: "OREB" },
  { category: "DREB", statField: "DREB" },
];

function fetchAllPlayers(
  perMode: "Totals" | "PerGame" = "Totals",
  measureType: "Base" | "Advanced" = "Base"
): Promise<NbaDashResponse> {
  const url =
    "https://stats.nba.com/stats/leaguedashplayerstats?" +
    "Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&ISTRound=" +
    "&LastNGames=0&LeagueID=00&Location=&MeasureType=" + measureType + "&Month=0&OpponentTeamID=0" +
    "&Outcome=&PORound=0&PaceAdjust=N&PerMode=" + perMode + "&Period=0&PlayerExperience=" +
    "&PlayerPosition=&PlusMinus=N&Rank=N&Season=" + SEASON +
    "&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=" +
    "&TeamID=0&TwoWay=0&VsConference=&VsDivision=&Weight=";

  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: NBA_HEADERS }, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`NBA API error (${measureType}): ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse NBA API response (${measureType})`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(300000, () => {
      req.destroy();
      reject(new Error(`NBA API timeout (${measureType})`));
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
  const querySecret = request.nextUrl.searchParams.get("cron_secret");
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: Record<string, number> = {};
  const now = new Date().toISOString();

  try {
    // Fetch base totals, per-game, and advanced stats in parallel
    const [baseData, perGameData, advData] = await Promise.all([
      fetchAllPlayers("Totals", "Base"),
      fetchAllPlayers("PerGame", "Base"),
      fetchAllPlayers("PerGame", "Advanced"),
    ]);

    const headers = baseData.resultSets[0].headers;
    const rows = baseData.resultSets[0].rowSet;

    const pgHeaders = perGameData.resultSets[0].headers;
    const pgRows = perGameData.resultSets[0].rowSet;

    const advHeaders = advData.resultSets[0].headers;
    const advRows = advData.resultSets[0].rowSet;

    const idx = (name: string) => headers.indexOf(name);
    const pgIdx = (name: string) => pgHeaders.indexOf(name);
    const aIdx = (name: string) => advHeaders.indexOf(name);

    const playerIdIdx = idx("PLAYER_ID");
    const playerIdx = idx("PLAYER_NAME");
    const teamIdx = idx("TEAM_ABBREVIATION");
    const gpIdx = idx("GP");
    const ptsIdx = idx("PTS");
    const fgaIdx = idx("FGA");
    const fgmIdx = idx("FGM");
    const fg3mIdx = idx("FG3M");
    const fg3aIdx = idx("FG3A");
    const ftaIdx = idx("FTA");
    const ftmIdx = idx("FTM");
    const nbaFantasyIdx = idx("NBA_FANTASY_PTS");

    // Index per-game data by player_id (official NBA per-game averages)
    const pgByPlayer = new Map<number, (string | number)[]>();
    const pgPlayerIdIdx = pgIdx("PLAYER_ID");
    for (const row of pgRows) {
      pgByPlayer.set(Number(row[pgPlayerIdIdx]), row);
    }

    // Index advanced data by player_id
    const advByPlayer = new Map<number, (string | number)[]>();
    const advPlayerIdIdx = aIdx("PLAYER_ID");
    const advGpIdx = aIdx("GP");
    for (const row of advRows) {
      advByPlayer.set(Number(row[advPlayerIdIdx]), row);
    }

    // ── League averages for "+" stats ──
    let leaguePTS = 0, leagueFGA = 0, leagueFGM = 0;
    let leagueFG3M = 0, leagueFG3A = 0;
    let leagueFTM = 0, leagueFTA = 0;
    for (const r of rows) {
      leaguePTS += Number(r[ptsIdx]);
      leagueFGA += Number(r[fgaIdx]);
      leagueFGM += Number(r[fgmIdx]);
      leagueFG3M += Number(r[fg3mIdx]);
      leagueFG3A += Number(r[fg3aIdx]);
      leagueFTM += Number(r[ftmIdx]);
      leagueFTA += Number(r[ftaIdx]);
    }

    const leagueTS = leagueFGA + 0.44 * leagueFTA > 0
      ? (leaguePTS / (2 * (leagueFGA + 0.44 * leagueFTA))) * 100 : 0;
    const leagueEFG = leagueFGA > 0
      ? ((leagueFGM + 0.5 * leagueFG3M) / leagueFGA) * 100 : 0;
    const leagueFG = leagueFGA > 0 ? (leagueFGM / leagueFGA) * 100 : 0;
    const leagueFG3 = leagueFG3A > 0 ? (leagueFG3M / leagueFG3A) * 100 : 0;
    const leagueFT = leagueFTA > 0 ? (leagueFTM / leagueFTA) * 100 : 0;
    const leagueFG2M = leagueFGM - leagueFG3M;
    const leagueFG2A = leagueFGA - leagueFG3A;
    const leagueFG2 = leagueFG2A > 0 ? (leagueFG2M / leagueFG2A) * 100 : 0;

    // ── Helpers ──
    const perGame = (row: (string | number)[], totalIdx: number) => {
      const gp = Number(row[gpIdx]);
      return gp > 0 ? Number(row[totalIdx]) / gp : 0;
    };

    const fgaPerGame = (row: (string | number)[]) => perGame(row, fgaIdx);
    const fg3aPerGame = (row: (string | number)[]) => perGame(row, fg3aIdx);
    const ftaPerGame = (row: (string | number)[]) => perGame(row, ftaIdx);

    function buildLeadersWithEligibility(
      category: string,
      allPlayers: { row: (string | number)[]; playerId: number; val: number; eligible: boolean }[]
    ): LeaderRow[] {
      const eligible = allPlayers.filter((p) => p.eligible).sort((a, b) => b.val - a.val);
      const ineligible = allPlayers.filter((p) => !p.eligible).sort((a, b) => b.val - a.val);
      const eligibleCount = eligible.length;

      const leaders: LeaderRow[] = [];

      // Metadata row
      leaders.push({
        category,
        rank: 0,
        player_name: "__eligible_count__",
        player_id: 0,
        team: "",
        value: eligibleCount,
        season: SEASON,
        updated_at: now,
      });

      eligible.forEach(({ row, playerId, val }, i) => {
        leaders.push({
          category,
          rank: i + 1,
          player_name: String(row[playerIdx]),
          player_id: playerId,
          team: String(row[teamIdx]),
          value: Math.round(val * 100) / 100,
          season: SEASON,
          updated_at: now,
        });
      });

      ineligible.forEach(({ row, playerId, val }, i) => {
        leaders.push({
          category,
          rank: eligibleCount + i + 1,
          player_name: String(row[playerIdx]),
          player_id: playerId,
          team: String(row[teamIdx]),
          value: Math.round(val * 100) / 100,
          season: SEASON,
          updated_at: now,
        });
      });

      return leaders;
    }

    // Advanced percentage fields come as decimals (0.285 for 28.5%) — multiply by 100
    const ADV_PCT_FIELDS = new Set([
      "USG_PCT", "AST_PCT", "OREB_PCT", "DREB_PCT", "REB_PCT", "PIE",
      "EFG_PCT", "TS_PCT",
    ]);

    // Helper for advanced categories (data comes from advByPlayer)
    function buildAdvancedCategory(
      category: string,
      statField: string,
      extraEligibility?: (advRow: (string | number)[], baseRow: (string | number)[]) => boolean
    ): LeaderRow[] {
      const allPlayers: { row: (string | number)[]; playerId: number; val: number; eligible: boolean }[] = [];
      const isPct = ADV_PCT_FIELDS.has(statField);

      for (const baseRow of rows) {
        const pid = Number(baseRow[playerIdIdx]);
        const advRow = advByPlayer.get(pid);
        if (!advRow) continue;

        const advStatIdx = aIdx(statField);
        if (advStatIdx === -1) continue;

        let val = Number(advRow[advStatIdx]);
        if (isNaN(val)) continue;

        // Convert decimal percentages to whole-number form (0.285 → 28.5)
        if (isPct) val *= 100;

        const gpEligible = Number(baseRow[gpIdx]) >= MIN_GP;
        const extraOk = extraEligibility ? extraEligibility(advRow, baseRow) : true;

        allPlayers.push({
          row: baseRow,
          playerId: pid,
          val,
          eligible: gpEligible && extraOk,
        });
      }

      return buildLeadersWithEligibility(category, allPlayers);
    }

    // ── Delete all existing stat_leaders for this season ──
    await supabase.from("stat_leaders").delete().eq("season", SEASON);

    // ── Direct categories (per-game from official NBA PerGame data) ──
    for (const { category, statField } of DIRECT_CATEGORIES) {
      const pgStatIdx = pgIdx(statField);

      const allPlayers = rows.map((row) => {
        const pid = Number(row[playerIdIdx]);
        const pgRow = pgByPlayer.get(pid);
        const val = pgRow && pgStatIdx !== -1 ? Number(pgRow[pgStatIdx]) : perGame(row, idx(statField));
        return {
          row,
          playerId: pid,
          val,
          eligible: Number(row[gpIdx]) >= MIN_GP,
        };
      });

      const leaders = buildLeadersWithEligibility(category, allPlayers);
      results[category] = await batchInsert(supabase, leaders);
    }

    // ── GP (games played — raw count, not per-game) ──
    const gpAllPlayers = rows.map((row) => ({
      row,
      playerId: Number(row[playerIdIdx]),
      val: Number(row[gpIdx]),
      eligible: Number(row[gpIdx]) >= MIN_GP,
    }));
    results["GP"] = await batchInsert(supabase, buildLeadersWithEligibility("GP", gpAllPlayers));

    // ── TOT_MIN (total minutes played — raw, not per-game) ──
    const minIdx = idx("MIN");
    const totMinAll = rows.map((row) => ({
      row,
      playerId: Number(row[playerIdIdx]),
      val: Number(row[minIdx]),
      eligible: Number(row[gpIdx]) >= MIN_GP,
    }));
    results["TOT_MIN"] = await batchInsert(supabase, buildLeadersWithEligibility("TOT_MIN", totMinAll));

    // ── Shooting attempt totals (raw season totals for filtering) ──
    const attemptCategories: { category: string; totalIdx: number }[] = [
      { category: "FGA_TOT", totalIdx: fgaIdx },
      { category: "FG3A_TOT", totalIdx: fg3aIdx },
      { category: "FTA_TOT", totalIdx: idx("FTA") },
    ];

    for (const { category, totalIdx } of attemptCategories) {
      const all = rows.map((row) => ({
        row,
        playerId: Number(row[playerIdIdx]),
        val: Number(row[totalIdx]),
        eligible: Number(row[gpIdx]) >= MIN_GP,
      }));
      results[category] = await batchInsert(supabase, buildLeadersWithEligibility(category, all));
    }

    // FG2A_TOT = FGA - FG3A
    const fg2aTotAll = rows.map((row) => ({
      row,
      playerId: Number(row[playerIdIdx]),
      val: Number(row[fgaIdx]) - Number(row[fg3aIdx]),
      eligible: Number(row[gpIdx]) >= MIN_GP,
    }));
    results["FG2A_TOT"] = await batchInsert(supabase, buildLeadersWithEligibility("FG2A_TOT", fg2aTotAll));

    // ── Season totals (raw cumulative stats) ──
    const totalCategories: { category: string; totalIdx: number }[] = [
      { category: "PTS_TOT", totalIdx: ptsIdx },
      { category: "REB_TOT", totalIdx: idx("REB") },
      { category: "AST_TOT", totalIdx: idx("AST") },
      { category: "BLK_TOT", totalIdx: idx("BLK") },
      { category: "STL_TOT", totalIdx: idx("STL") },
      { category: "TOV_TOT", totalIdx: idx("TOV") },
      { category: "FGM_TOT", totalIdx: fgmIdx },
      { category: "FG3M_TOT", totalIdx: fg3mIdx },
      { category: "FTM_TOT", totalIdx: ftmIdx },
      { category: "OREB_TOT", totalIdx: idx("OREB") },
      { category: "DREB_TOT", totalIdx: idx("DREB") },
      { category: "PF_TOT", totalIdx: idx("PF") },
      { category: "PLUS_MINUS_TOT", totalIdx: idx("PLUS_MINUS") },
    ];

    for (const { category, totalIdx } of totalCategories) {
      const all = rows.map((row) => ({
        row,
        playerId: Number(row[playerIdIdx]),
        val: Number(row[totalIdx]),
        eligible: Number(row[gpIdx]) >= MIN_GP,
      }));
      results[category] = await batchInsert(supabase, buildLeadersWithEligibility(category, all));
    }

    // FG2M_TOT = FGM - FG3M
    const fg2mTotAll = rows.map((row) => ({
      row,
      playerId: Number(row[playerIdIdx]),
      val: Number(row[fgmIdx]) - Number(row[fg3mIdx]),
      eligible: Number(row[gpIdx]) >= MIN_GP,
    }));
    results["FG2M_TOT"] = await batchInsert(supabase, buildLeadersWithEligibility("FG2M_TOT", fg2mTotAll));

    // ── Calculated percentage categories (from totals for precision) ──

    // FG3_PCT
    const fg3All = rows
      .filter((r) => Number(r[fg3aIdx]) > 0)
      .map((r) => ({
        row: r,
        playerId: Number(r[playerIdIdx]),
        val: (Number(r[fg3mIdx]) / Number(r[fg3aIdx])) * 100,
        eligible: Number(r[gpIdx]) >= MIN_GP && fg3aPerGame(r) >= MIN_FG3A,
      }));
    results["FG3_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("FG3_PCT", fg3All));

    // FG2_PCT
    const fg2All = rows
      .filter((r) => Number(r[fgaIdx]) - Number(r[fg3aIdx]) > 0)
      .map((r) => {
        const fg2m = Number(r[fgmIdx]) - Number(r[fg3mIdx]);
        const fg2a = Number(r[fgaIdx]) - Number(r[fg3aIdx]);
        const fg2aPerG = Number(r[gpIdx]) > 0 ? fg2a / Number(r[gpIdx]) : 0;
        return {
          row: r,
          playerId: Number(r[playerIdIdx]),
          val: fg2a > 0 ? (fg2m / fg2a) * 100 : 0,
          eligible: Number(r[gpIdx]) >= MIN_GP && fg2aPerG >= MIN_FG2A,
        };
      });
    results["FG2_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("FG2_PCT", fg2All));

    // TS_PCT
    const tsAll = rows
      .filter((r) => Number(r[fgaIdx]) > 0)
      .map((r) => {
        const pts = Number(r[ptsIdx]);
        const fga = Number(r[fgaIdx]);
        const fta = Number(r[ftaIdx]);
        return {
          row: r,
          playerId: Number(r[playerIdIdx]),
          val: (pts / (2 * (fga + 0.44 * fta))) * 100,
          eligible: Number(r[gpIdx]) >= MIN_GP && fgaPerGame(r) >= MIN_FGA,
        };
      });
    results["TS_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("TS_PCT", tsAll));

    // FG_PCT
    const fgAll = rows
      .filter((r) => Number(r[fgaIdx]) > 0)
      .map((r) => ({
        row: r,
        playerId: Number(r[playerIdIdx]),
        val: (Number(r[fgmIdx]) / Number(r[fgaIdx])) * 100,
        eligible: Number(r[gpIdx]) >= MIN_GP && fgaPerGame(r) >= MIN_FGA,
      }));
    results["FG_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("FG_PCT", fgAll));

    // FT_PCT
    const ftAll = rows
      .filter((r) => Number(r[ftaIdx]) > 0)
      .map((r) => ({
        row: r,
        playerId: Number(r[playerIdIdx]),
        val: (Number(r[ftmIdx]) / Number(r[ftaIdx])) * 100,
        eligible: Number(r[gpIdx]) >= MIN_GP && ftaPerGame(r) >= MIN_FTA,
      }));
    results["FT_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("FT_PCT", ftAll));

    // EFG_PCT — (FGM + 0.5 * FG3M) / FGA (from totals)
    const efgAll = rows
      .filter((r) => Number(r[fgaIdx]) > 0)
      .map((r) => ({
        row: r,
        playerId: Number(r[playerIdIdx]),
        val: ((Number(r[fgmIdx]) + 0.5 * Number(r[fg3mIdx])) / Number(r[fgaIdx])) * 100,
        eligible: Number(r[gpIdx]) >= MIN_GP && fgaPerGame(r) >= MIN_FGA,
      }));
    results["EFG_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("EFG_PCT", efgAll));

    // ── Advanced rate categories (from NBA Advanced API) ──
    const advancedCats: { category: string; statField: string }[] = [
      { category: "USG_PCT", statField: "USG_PCT" },
      { category: "OFF_RATING", statField: "OFF_RATING" },
      { category: "DEF_RATING", statField: "DEF_RATING" },
      { category: "NET_RATING", statField: "NET_RATING" },
      { category: "AST_PCT", statField: "AST_PCT" },
      { category: "OREB_PCT", statField: "OREB_PCT" },
      { category: "DREB_PCT", statField: "DREB_PCT" },
      { category: "REB_PCT", statField: "REB_PCT" },
      { category: "PACE", statField: "PACE" },
      { category: "PIE", statField: "PIE" },
    ];

    for (const { category, statField } of advancedCats) {
      const leaders = buildAdvancedCategory(category, statField);
      results[category] = await batchInsert(supabase, leaders);
    }

    // ── Adjusted "+" stats (player / league average * 100) ──

    // TS+
    if (leagueTS > 0) {
      const tsPlus = rows
        .filter((r) => Number(r[fgaIdx]) > 0)
        .map((r) => {
          const pts = Number(r[ptsIdx]);
          const fga = Number(r[fgaIdx]);
          const fta = Number(r[ftaIdx]);
          const playerTS = (pts / (2 * (fga + 0.44 * fta))) * 100;
          return {
            row: r,
            playerId: Number(r[playerIdIdx]),
            val: (playerTS / leagueTS) * 100,
            eligible: Number(r[gpIdx]) >= MIN_GP && fgaPerGame(r) >= MIN_FGA,
          };
        });
      results["TS_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("TS_PLUS", tsPlus));
    }

    // eFG+
    if (leagueEFG > 0) {
      const efgPlus = rows
        .filter((r) => Number(r[fgaIdx]) > 0)
        .map((r) => ({
          row: r,
          playerId: Number(r[playerIdIdx]),
          val: (((Number(r[fgmIdx]) + 0.5 * Number(r[fg3mIdx])) / Number(r[fgaIdx])) * 100 / leagueEFG) * 100,
          eligible: Number(r[gpIdx]) >= MIN_GP && fgaPerGame(r) >= MIN_FGA,
        }));
      results["EFG_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("EFG_PLUS", efgPlus));
    }

    // FG+
    if (leagueFG > 0) {
      const fgPlus = rows
        .filter((r) => Number(r[fgaIdx]) > 0)
        .map((r) => ({
          row: r,
          playerId: Number(r[playerIdIdx]),
          val: ((Number(r[fgmIdx]) / Number(r[fgaIdx])) * 100 / leagueFG) * 100,
          eligible: Number(r[gpIdx]) >= MIN_GP && fgaPerGame(r) >= MIN_FGA,
        }));
      results["FG_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("FG_PLUS", fgPlus));
    }

    // 3P+
    if (leagueFG3 > 0) {
      const fg3Plus = rows
        .filter((r) => Number(r[fg3aIdx]) > 0)
        .map((r) => ({
          row: r,
          playerId: Number(r[playerIdIdx]),
          val: ((Number(r[fg3mIdx]) / Number(r[fg3aIdx])) * 100 / leagueFG3) * 100,
          eligible: Number(r[gpIdx]) >= MIN_GP && fg3aPerGame(r) >= MIN_FG3A,
        }));
      results["FG3_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("FG3_PLUS", fg3Plus));
    }

    // FT+
    if (leagueFT > 0) {
      const ftPlus = rows
        .filter((r) => Number(r[ftaIdx]) > 0)
        .map((r) => ({
          row: r,
          playerId: Number(r[playerIdIdx]),
          val: ((Number(r[ftmIdx]) / Number(r[ftaIdx])) * 100 / leagueFT) * 100,
          eligible: Number(r[gpIdx]) >= MIN_GP && ftaPerGame(r) >= MIN_FTA,
        }));
      results["FT_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("FT_PLUS", ftPlus));
    }

    // 2P+
    if (leagueFG2 > 0) {
      const fg2Plus = rows
        .filter((r) => Number(r[fgaIdx]) - Number(r[fg3aIdx]) > 0)
        .map((r) => {
          const fg2m = Number(r[fgmIdx]) - Number(r[fg3mIdx]);
          const fg2a = Number(r[fgaIdx]) - Number(r[fg3aIdx]);
          const fg2aPerG = Number(r[gpIdx]) > 0 ? fg2a / Number(r[gpIdx]) : 0;
          return {
            row: r,
            playerId: Number(r[playerIdIdx]),
            val: fg2a > 0 ? ((fg2m / fg2a) * 100 / leagueFG2) * 100 : 0,
            eligible: Number(r[gpIdx]) >= MIN_GP && fg2aPerG >= MIN_FG2A,
          };
        });
      results["FG2_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("FG2_PLUS", fg2Plus));
    }
  } catch (err) {
    console.error("Error syncing stats:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }

  revalidatePath("/statistiques");
  console.log(`[SYNC-STATS] Completed at ${new Date().toISOString()}`);

  return NextResponse.json({
    ok: true,
    synced: results,
    timestamp: new Date().toISOString(),
  });
}
