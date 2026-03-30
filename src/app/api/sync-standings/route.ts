import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSeason } from "@/lib/season";

const SEASON = getCurrentSeason();
// ESPN uses the END year of the season (e.g. "2025-26" → 2026)
const ESPN_YEAR = parseInt(SEASON.split("-")[0], 10) + 1;
const ESPN_URL =
  `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${ESPN_YEAR}`;

// ESPN uses different tricodes than NBA — map to standard NBA tricodes
const TRICODE_MAP: Record<string, string> = {
  GS: "GSW",
  NY: "NYK",
  SA: "SAS",
  NO: "NOP",
  WSH: "WAS",
  UTAH: "UTA",
};

interface EspnStandingsResponse {
  children: {
    name: string;
    abbreviation: string;
    standings: {
      entries: {
        team: {
          abbreviation: string;
          location: string;
          name: string;
        };
        stats: {
          name: string;
          value?: number;
          displayValue?: string;
          summary?: string;
        }[];
      }[];
    };
  }[];
}

function fetchStandings(): Promise<EspnStandingsResponse> {
  return new Promise((resolve, reject) => {
    const req = https.get(ESPN_URL, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`ESPN API error: ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Failed to parse standings"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(600000, () => { req.destroy(); reject(new Error("ESPN timeout after 10min")); });
  });
}

function getStat(
  stats: EspnStandingsResponse["children"][0]["standings"]["entries"][0]["stats"],
  name: string
) {
  return stats.find((s) => s.name === name);
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
    console.log("[SYNC-STANDINGS] Starting sync...");
    console.log("[SYNC-STANDINGS] Fetching from ESPN...");
    const response = await fetchStandings();
    const now = new Date().toISOString();

    const standings = response.children.flatMap((conference) => {
      const confName =
        conference.abbreviation === "East" ? "East" : "West";

      return conference.standings.entries.map((entry) => {
        const { team, stats } = entry;

        return {
          conference: confName,
          team_tricode: TRICODE_MAP[team.abbreviation] || team.abbreviation,
          team_name: team.name,
          team_city: team.location,
          wins: getStat(stats, "wins")?.value ?? 0,
          losses: getStat(stats, "losses")?.value ?? 0,
          win_pct: getStat(stats, "winPercent")?.value ?? 0,
          home_record: getStat(stats, "Home")?.summary ?? "0-0",
          road_record: getStat(stats, "Road")?.summary ?? "0-0",
          last_10: getStat(stats, "Last Ten Games")?.summary ?? "0-0",
          streak: getStat(stats, "streak")?.displayValue ?? "",
          conference_rank: getStat(stats, "playoffSeed")?.value ?? 0,
          season: SEASON,
          updated_at: now,
        };
      });
    });

    console.log(`[SYNC-STANDINGS] Fetched ${standings.length} rows from API`);
    console.log(`[SYNC-STANDINGS] Upserting ${standings.length} rows into standings...`);
    const { error } = await supabase.from("standings").upsert(standings, { onConflict: "team_tricode,season" });
    if (error) {
      console.error("Error inserting standings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[SYNC-STANDINGS] Upserted ${standings.length} rows successfully`);
    revalidatePath("/classement");
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC-STANDINGS] Completed at ${now} (took ${duration}s)`);

    return NextResponse.json({
      ok: true,
      teams: standings.length,
      timestamp: now,
    });
  } catch (err) {
    console.error("Error syncing standings:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
