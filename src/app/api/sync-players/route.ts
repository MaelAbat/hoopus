import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const BATCH_SIZE = 200;

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
  resultSets: {
    headers: string[];
    rowSet: (string | number | null)[][];
  }[];
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
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Failed to parse NBA API response"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(600000, () => { req.destroy(); reject(new Error("NBA API timeout after 10min")); });
  });
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

  const startTime = Date.now();

  try {
    console.log("[SYNC-PLAYERS] Starting sync...");
    console.log("[SYNC-PLAYERS] Fetching from stats.nba.com (timeout 10min)...");
    // Only fetch active players (Historical=0) — much smaller payload
    // Historical players already in DB are preserved via upsert
    const indexData = await fetchNba(
      "https://stats.nba.com/stats/playerindex?" +
        "College=&Conference=&Country=&DraftPick=&DraftRound=&DraftYear=" +
        "&Height=&Historical=0&LeagueID=00&Season=2025-26" +
        "&SeasonType=Regular+Season&TeamID=0&Weight="
    );

    const headers = indexData.resultSets[0].headers;
    const rows = indexData.resultSets[0].rowSet;
    const ii = (name: string) => headers.indexOf(name);

    console.log(`[SYNC-PLAYERS] Fetched ${rows.length} rows from API`);

    const now = new Date().toISOString();
    const players = [];

    for (const row of rows) {
      const playerId = Number(row[ii("PERSON_ID")]);
      if (!playerId) continue;

      const rosterStatus = row[ii("ROSTER_STATUS")];
      const isActive = rosterStatus === 1 || rosterStatus === "1";

      players.push({
        player_id: playerId,
        first_name: String(row[ii("PLAYER_FIRST_NAME")] || ""),
        last_name: String(row[ii("PLAYER_LAST_NAME")] || ""),
        team_tricode: row[ii("TEAM_ABBREVIATION")] ? String(row[ii("TEAM_ABBREVIATION")]) : null,
        team_name: row[ii("TEAM_NAME")] ? String(row[ii("TEAM_NAME")]) : null,
        team_city: row[ii("TEAM_CITY")] ? String(row[ii("TEAM_CITY")]) : null,
        jersey_number: row[ii("JERSEY_NUMBER")] != null ? String(row[ii("JERSEY_NUMBER")]) : null,
        position: row[ii("POSITION")] ? String(row[ii("POSITION")]) : null,
        height: row[ii("HEIGHT")] ? String(row[ii("HEIGHT")]) : null,
        weight: row[ii("WEIGHT")] ? String(row[ii("WEIGHT")]) : null,
        college: row[ii("COLLEGE")] ? String(row[ii("COLLEGE")]) : null,
        country: row[ii("COUNTRY")] ? String(row[ii("COUNTRY")]) : null,
        draft_year: row[ii("DRAFT_YEAR")] ? Number(row[ii("DRAFT_YEAR")]) : null,
        draft_round: row[ii("DRAFT_ROUND")] ? Number(row[ii("DRAFT_ROUND")]) : null,
        draft_number: row[ii("DRAFT_NUMBER")] ? Number(row[ii("DRAFT_NUMBER")]) : null,
        from_year: row[ii("FROM_YEAR")] ? Number(row[ii("FROM_YEAR")]) : null,
        to_year: row[ii("TO_YEAR")] ? Number(row[ii("TO_YEAR")]) : null,
        is_active: isActive,
        pts: row[ii("PTS")] != null ? Number(row[ii("PTS")]) : null,
        reb: row[ii("REB")] != null ? Number(row[ii("REB")]) : null,
        ast: row[ii("AST")] != null ? Number(row[ii("AST")]) : null,
        updated_at: now,
      });
    }

    // Upsert players
    console.log(`[SYNC-PLAYERS] Upserting ${players.length} rows into players...`);
    let inserted = 0;
    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      const batch = players.slice(i, i + BATCH_SIZE);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("players").upsert(batch as any, {
        onConflict: "player_id",
      });
      if (error) {
        console.error(`Batch upsert error at ${i}:`, error);
      } else {
        inserted += batch.length;
      }
    }

    console.log(`[SYNC-PLAYERS] Upserted ${inserted} rows successfully`);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC-PLAYERS] Completed at ${now} (took ${duration}s)`);

    return NextResponse.json({
      ok: true,
      total: players.length,
      inserted,
      active: players.filter(p => p.is_active).length,
      historical: players.filter(p => !p.is_active).length,
      timestamp: now,
    });
  } catch (err) {
    console.error("Error syncing players:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
