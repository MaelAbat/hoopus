import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";
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
    req.setTimeout(60000, () => {
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

  try {
    // Fetch player index (roster info) and bio stats (age) in parallel
    const [indexData, bioData] = await Promise.all([
      fetchNba(
        "https://stats.nba.com/stats/playerindex?" +
          "College=&Conference=&Country=&DraftPick=&DraftRound=&DraftYear=" +
          "&Height=&Historical=0&LeagueID=00&Season=" + SEASON +
          "&SeasonType=Regular+Season&TeamID=0&Weight="
      ),
      fetchNba(
        "https://stats.nba.com/stats/leaguedashplayerbiostats?" +
          "College=&Conference=&Country=&DateFrom=&DateTo=&Division=" +
          "&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=" +
          "&ISTRound=&LastNGames=0&LeagueID=00&Location=&Month=0" +
          "&OpponentTeamID=0&Outcome=&PORound=0&PerMode=PerGame" +
          "&Period=0&PlayerExperience=&PlayerPosition=&Season=" + SEASON +
          "&SeasonSegment=&SeasonType=Regular+Season" +
          "&ShotClockRange=&StarterBench=&TeamID=0" +
          "&VsConference=&VsDivision=&Weight="
      ),
    ]);

    // Parse player index
    const idxHeaders = indexData.resultSets[0].headers;
    const idxRows = indexData.resultSets[0].rowSet;
    const ii = (name: string) => idxHeaders.indexOf(name);

    // Parse bio stats (for age)
    const bioHeaders = bioData.resultSets[0].headers;
    const bioRows = bioData.resultSets[0].rowSet;
    const bi = (name: string) => bioHeaders.indexOf(name);

    // Build age lookup: player_id → age
    const ageMap = new Map<number, number>();
    for (const row of bioRows) {
      const playerId = Number(row[bi("PLAYER_ID")]);
      const age = row[bi("AGE")] != null ? Number(row[bi("AGE")]) : null;
      if (playerId && age) ageMap.set(playerId, age);
    }

    const now = new Date().toISOString();
    const players = [];

    for (const row of idxRows) {
      const rosterStatus = row[ii("ROSTER_STATUS")];
      // Only include players currently on a roster
      if (rosterStatus !== 1 && rosterStatus !== "1") continue;

      const playerId = Number(row[ii("PERSON_ID")]);
      const teamTricode = String(row[ii("TEAM_ABBREVIATION")] || "");
      if (!teamTricode) continue;

      players.push({
        season: SEASON,
        player_id: playerId,
        first_name: String(row[ii("PLAYER_FIRST_NAME")] || ""),
        last_name: String(row[ii("PLAYER_LAST_NAME")] || ""),
        team_tricode: teamTricode,
        team_name: String(row[ii("TEAM_NAME")] || ""),
        team_city: String(row[ii("TEAM_CITY")] || ""),
        jersey_number: String(row[ii("JERSEY_NUMBER")] ?? ""),
        position: String(row[ii("POSITION")] || ""),
        height: String(row[ii("HEIGHT")] || ""),
        weight: String(row[ii("WEIGHT")] || ""),
        age: ageMap.get(playerId) || null,
        college: String(row[ii("COLLEGE")] || ""),
        country: String(row[ii("COUNTRY")] || ""),
        draft_year: row[ii("DRAFT_YEAR")] ? Number(row[ii("DRAFT_YEAR")]) : null,
        draft_round: row[ii("DRAFT_ROUND")] ? Number(row[ii("DRAFT_ROUND")]) : null,
        draft_number: row[ii("DRAFT_NUMBER")] ? Number(row[ii("DRAFT_NUMBER")]) : null,
        pts: row[ii("PTS")] != null ? Number(row[ii("PTS")]) : null,
        reb: row[ii("REB")] != null ? Number(row[ii("REB")]) : null,
        ast: row[ii("AST")] != null ? Number(row[ii("AST")]) : null,
        updated_at: now,
      });
    }

    // Clear and reinsert
    await supabase.from("rosters").delete().eq("season", SEASON);

    let inserted = 0;
    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      const batch = players.slice(i, i + BATCH_SIZE);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("rosters").insert(batch as any);
      if (error) {
        console.error(`Batch insert error at ${i}:`, error);
      } else {
        inserted += batch.length;
      }
    }

    return NextResponse.json({
      ok: true,
      players: inserted,
      timestamp: now,
    });
  } catch (err) {
    console.error("Error syncing rosters:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
