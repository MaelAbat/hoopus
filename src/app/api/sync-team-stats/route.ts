import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";

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

function fetchTeamStats(measureType: "Base" | "Advanced"): Promise<NbaDashResponse> {
  const url =
    "https://stats.nba.com/stats/leaguedashteamstats?" +
    "Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&ISTRound=" +
    "&LastNGames=0&LeagueID=00&Location=&MeasureType=" + measureType +
    "&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0" +
    "&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=" + SEASON +
    "&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=" +
    "&TeamID=0&TwoWay=0&VsConference=&VsDivision=";

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
    req.setTimeout(300000, () => {
      req.destroy();
      reject(new Error("NBA API timeout"));
    });
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

  const now = new Date().toISOString();

  try {
    console.log("[SYNC-TEAM-STATS] Fetching base and advanced stats...");
    const [baseData, advData] = await Promise.all([
      fetchTeamStats("Base"),
      fetchTeamStats("Advanced"),
    ]);

    const baseH = baseData.resultSets[0].headers;
    const baseRows = baseData.resultSets[0].rowSet;
    const advH = advData.resultSets[0].headers;
    const advRows = advData.resultSets[0].rowSet;

    const bIdx = (name: string) => baseH.indexOf(name);
    const aIdx = (name: string) => advH.indexOf(name);

    // Index advanced rows by team ID for merging
    const advByTeam = new Map<number, (string | number)[]>();
    for (const row of advRows) {
      advByTeam.set(Number(row[aIdx("TEAM_ID")]), row);
    }

    // Build team stats rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamStats: any[] = baseRows.map((row) => {
      const teamId = Number(row[bIdx("TEAM_ID")]);
      const adv = advByTeam.get(teamId);

      return {
        team_id: teamId,
        team_name: String(row[bIdx("TEAM_NAME")]),
        team_tricode: String(row[bIdx("TEAM_NAME")]).split(" ").pop() || "",
        season: SEASON,
        gp: Number(row[bIdx("GP")]),
        w: Number(row[bIdx("W")]),
        l: Number(row[bIdx("L")]),
        w_pct: Number(row[bIdx("W_PCT")]),
        pts: Number(row[bIdx("PTS")]),
        reb: Number(row[bIdx("REB")]),
        ast: Number(row[bIdx("AST")]),
        stl: Number(row[bIdx("STL")]),
        blk: Number(row[bIdx("BLK")]),
        tov: Number(row[bIdx("TOV")]),
        fg_pct: Number(row[bIdx("FG_PCT")]),
        fg3_pct: Number(row[bIdx("FG3_PCT")]),
        ft_pct: Number(row[bIdx("FT_PCT")]),
        oreb: Number(row[bIdx("OREB")]),
        dreb: Number(row[bIdx("DREB")]),
        plus_minus: Number(row[bIdx("PLUS_MINUS")]),
        off_rating: adv ? Number(adv[aIdx("OFF_RATING")]) : 0,
        def_rating: adv ? Number(adv[aIdx("DEF_RATING")]) : 0,
        net_rating: adv ? Number(adv[aIdx("NET_RATING")]) : 0,
        pace: adv ? Number(adv[aIdx("PACE")]) : 0,
        ts_pct: adv ? Number(adv[aIdx("TS_PCT")]) : 0,
        efg_pct: adv ? Number(adv[aIdx("EFG_PCT")]) : 0,
        ast_pct: adv ? Number(adv[aIdx("AST_PCT")]) : 0,
        ast_ratio: adv ? Number(adv[aIdx("AST_RATIO")]) : 0,
        oreb_pct: adv ? Number(adv[aIdx("OREB_PCT")]) : 0,
        dreb_pct: adv ? Number(adv[aIdx("DREB_PCT")]) : 0,
        tm_tov_pct: adv ? Number(adv[aIdx("TM_TOV_PCT")]) : 0,
        pie: adv ? Number(adv[aIdx("PIE")]) : 0,
        updated_at: now,
      };
    });

    // Map team tricodes from team IDs
    const TRICODE_MAP: Record<number, string> = {
      1610612737: "ATL", 1610612738: "BOS", 1610612751: "BKN", 1610612766: "CHA",
      1610612741: "CHI", 1610612739: "CLE", 1610612742: "DAL", 1610612743: "DEN",
      1610612765: "DET", 1610612744: "GSW", 1610612745: "HOU", 1610612754: "IND",
      1610612746: "LAC", 1610612747: "LAL", 1610612763: "MEM", 1610612748: "MIA",
      1610612749: "MIL", 1610612750: "MIN", 1610612740: "NOP", 1610612752: "NYK",
      1610612760: "OKC", 1610612753: "ORL", 1610612755: "PHI", 1610612756: "PHX",
      1610612757: "POR", 1610612758: "SAC", 1610612759: "SAS", 1610612761: "TOR",
      1610612762: "UTA", 1610612764: "WAS",
    };

    for (const ts of teamStats) {
      ts.team_tricode = TRICODE_MAP[ts.team_id] || ts.team_tricode;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("team_stats").upsert(teamStats as any, { onConflict: "team_id,season" });

    if (error) {
      console.error("Error inserting team stats:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/statistiques");
    revalidatePath("/equipes");
    console.log(`[SYNC-TEAM-STATS] Completed at ${now}`);

    return NextResponse.json({
      ok: true,
      teams: teamStats.length,
      timestamp: now,
    });

  } catch (err) {
    console.error("Error syncing team stats:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
