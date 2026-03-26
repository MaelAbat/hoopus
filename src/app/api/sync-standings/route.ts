import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";
const ESPN_URL =
  "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=2026";

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
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("ESPN API timeout"));
    });
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
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  console.log("[sync-standings] auth debug:", {
    received: authHeader?.slice(0, 20) + "...",
    expected: expected?.slice(0, 20) + "...",
    match: authHeader === expected,
    cronSecretLength: process.env.CRON_SECRET?.length,
    cronSecretDefined: !!process.env.CRON_SECRET,
  });

  const isAuthorized = authHeader === expected;

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
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

    // Clear and reinsert
    await supabase.from("standings").delete().eq("season", SEASON);

    const { error } = await supabase.from("standings").insert(standings);
    if (error) {
      console.error("Error inserting standings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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
