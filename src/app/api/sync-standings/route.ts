import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { fetchLeagueState } from "@/lib/league-season";
import { isCronAuthorized } from "@/lib/cron-auth";
import { fetchEspnJson } from "@/lib/espn-fetch";
import { isUpstreamUnavailable } from "@/lib/upstream";

// Saison résolue par requête depuis league_state (voir /api/sync-season).
// ESPN uses the END year of the season (e.g. "2025-26" → 2026)
function espnUrl(season: string): string {
  const espnYear = parseInt(season.split("-")[0], 10) + 1;
  return `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${espnYear}`;
}

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

function fetchStandings(season: string): Promise<EspnStandingsResponse> {
  return fetchEspnJson<EspnStandingsResponse>(espnUrl(season), {
    label: `classement ${season}`,
  });
}

function getStat(
  stats: EspnStandingsResponse["children"][0]["standings"]["entries"][0]["stats"],
  name: string
) {
  return stats.find((s) => s.name === name);
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

  try {
    console.log("[SYNC-STANDINGS] Starting sync...");
    console.log("[SYNC-STANDINGS] Fetching from ESPN...");
    const SEASON = (await fetchLeagueState()).currentSeason;
    console.log(`[SYNC-STANDINGS] Saison ${SEASON}`);
    const response = await fetchStandings(SEASON);
    const now = new Date().toISOString();

    // Une saison qui n'a pas commencé renvoie bien les deux conférences, mais
    // sans `entries` : ESPN ne publie le classement qu'au premier match. Ce
    // n'est pas une erreur, simplement zéro ligne à écrire.
    const standings = (response.children ?? []).flatMap((conference) => {
      const confName =
        conference.abbreviation === "East" ? "East" : "West";

      return (conference.standings?.entries ?? []).map((entry) => {
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

    if (standings.length === 0) {
      console.log(`[SYNC-STANDINGS] Aucun classement publié pour ${SEASON} — rien à écrire`);
      return NextResponse.json({
        ok: true,
        teams: 0,
        season: SEASON,
        message: "Classement pas encore publié pour cette saison",
        timestamp: now,
      });
    }

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
    // Une source qui nous refuse l'accès n'est pas une panne de la route : on le
    // dit en une ligne, sans trace d'exception, et on répond « rien à faire ».
    if (isUpstreamUnavailable(err)) {
      console.warn(`[SYNC-STANDINGS] ${err.source} indisponible (${err.message}) — classement inchangé`);
      return NextResponse.json({
        ok: true,
        skipped: `${err.source} indisponible`,
        reason: err.message,
        timestamp: new Date().toISOString(),
      });
    }
    console.error("Error syncing standings:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
