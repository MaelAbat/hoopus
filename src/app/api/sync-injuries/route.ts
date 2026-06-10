import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSeason } from "@/lib/season";
import { isCronAuthorized } from "@/lib/cron-auth";

const SEASON = getCurrentSeason();

// ESPN team abbreviations for all 30 teams
const ESPN_TEAMS = [
  "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GS",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NO", "NY",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SA", "TOR", "UTAH", "WSH",
];

// ESPN → NBA standard tricodes
const TRICODE_MAP: Record<string, string> = {
  GS: "GSW",
  NY: "NYK",
  SA: "SAS",
  NO: "NOP",
  WSH: "WAS",
  UTAH: "UTA",
};

// With ?team= param, injuries are a flat array (not grouped by team)
interface EspnInjuryEntry {
  status: string;
  date: string;
  athlete: {
    displayName: string;
    position?: { abbreviation?: string };
    team?: { abbreviation?: string };
  };
  details?: {
    type?: string;
    detail?: string;
    side?: string;
    returnDate?: string;
  };
  shortComment?: string;
}

interface EspnInjuryResponse {
  injuries: EspnInjuryEntry[];
  team?: { abbreviation?: string };
}

function fetchEspn(team: string): Promise<EspnInjuryResponse> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries?team=${team}`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`ESPN API error: ${res.statusCode} for ${team}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
        } catch {
          reject(new Error(`Failed to parse ESPN response for ${team}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`ESPN timeout for ${team}`)); });
  });
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const startTime = Date.now();
  const now = new Date().toISOString();
  console.log("[SYNC-INJURIES] Starting sync...");

  try {
    // Fetch all 30 teams in batches of 6 to avoid overwhelming ESPN
    const allInjuries: {
      player_name: string;
      player_position: string | null;
      team: string;
      status: string;
      injury_type: string | null;
      injury_detail: string | null;
      injury_side: string | null;
      return_date: string | null;
      short_comment: string | null;
      season: string;
      updated_at: string;
    }[] = [];

    const BATCH_SIZE = 6;
    for (let i = 0; i < ESPN_TEAMS.length; i += BATCH_SIZE) {
      const batch = ESPN_TEAMS.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(fetchEspn));

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status !== "fulfilled") {
          console.log(`[SYNC-INJURIES] Failed to fetch ${batch[j]}: ${result.reason}`);
          continue;
        }

        const data = result.value;
        const espnTeamAbbr = data.team?.abbreviation || batch[j];
        const team = TRICODE_MAP[espnTeamAbbr] || espnTeamAbbr;

        for (const injury of data.injuries || []) {
          allInjuries.push({
            player_name: injury.athlete?.displayName || "Unknown",
            player_position: injury.athlete?.position?.abbreviation || null,
            team,
            status: injury.status || "Unknown",
            injury_type: injury.details?.type || null,
            injury_detail: injury.details?.detail || null,
            injury_side: injury.details?.side || null,
            return_date: injury.details?.returnDate || null,
            short_comment: injury.shortComment || null,
            season: SEASON,
            updated_at: now,
          });
        }
      }
    }

    console.log(`[SYNC-INJURIES] Fetched ${allInjuries.length} injuries across 30 teams`);

    // Full replace: clear then insert fresh data (removes healed players)
    const { error: delError } = await supabase.from("injuries").delete().eq("season", SEASON);
    if (delError) console.error(`[SYNC-INJURIES] Delete error:`, delError.message);

    if (allInjuries.length > 0) {
      for (let i = 0; i < allInjuries.length; i += 200) {
        const chunk = allInjuries.slice(i, i + 200);
        const { error } = await supabase.from("injuries").insert(chunk);
        if (error) {
          console.error(`[SYNC-INJURIES] Insert error (batch ${i}):`, error.message);
        }
      }
    }

    revalidatePath("/blessures");
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC-INJURIES] Completed at ${now} (took ${duration}s)`);

    return NextResponse.json({
      ok: true,
      injuries: allInjuries.length,
      timestamp: now,
    });
  } catch (err) {
    console.error("[SYNC-INJURIES] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
