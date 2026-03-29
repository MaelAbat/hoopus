import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";

interface NbaTeam {
  teamTricode: string;
  teamName: string;
  score: number;
}

interface NbaGame {
  gameId: string;
  gameDateEst: string;
  gameTimeEst: string;
  gameStatus: number;
  gameStatusText: string;
  homeTeam: NbaTeam;
  awayTeam: NbaTeam;
  arenaName: string;
  arenaCity: string;
}

interface NbaSchedule {
  leagueSchedule: {
    gameDates: {
      gameDate: string;
      games: NbaGame[];
    }[];
  };
}

function fetchSchedule(): Promise<NbaSchedule> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`CDN error: ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Failed to parse schedule"));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(600000, () => { req.destroy(); reject(new Error("CDN timeout after 10min")); });
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
    console.log("[SYNC-GAMES] Starting sync...");
    console.log("[SYNC-GAMES] Fetching from NBA CDN...");
    const schedule = await fetchSchedule();
    const gameDates = schedule.leagueSchedule.gameDates;

    let totalInserted = 0;
    const now = new Date().toISOString();

    // Process in batches of 100 games
    const allGames: {
      game_id: string;
      game_date: string;
      game_time: string;
      status: number;
      status_text: string;
      home_team: string;
      home_team_name: string;
      home_score: number;
      away_team: string;
      away_team_name: string;
      away_score: number;
      arena: string;
      arena_city: string;
      season: string;
      updated_at: string;
    }[] = [];

    for (const dateEntry of gameDates) {
      for (const game of dateEntry.games) {
        // Only include regular season games (gameId starts with 002)
        if (!game.gameId.startsWith("002")) continue;

        const gameDate = game.gameDateEst.split("T")[0];

        allGames.push({
          game_id: game.gameId,
          game_date: gameDate,
          game_time: game.gameTimeEst,
          status: game.gameStatus,
          status_text: game.gameStatusText?.trim() || "",
          home_team: game.homeTeam.teamTricode,
          home_team_name: game.homeTeam.teamName,
          home_score: game.homeTeam.score || 0,
          away_team: game.awayTeam.teamTricode,
          away_team_name: game.awayTeam.teamName,
          away_score: game.awayTeam.score || 0,
          arena: game.arenaName || "",
          arena_city: game.arenaCity || "",
          season: SEASON,
          updated_at: now,
        });
      }
    }

    console.log(`[SYNC-GAMES] Fetched ${allGames.length} games from API`);
    console.log(`[SYNC-GAMES] Upserting ${allGames.length} rows into games...`);

    // Upsert in batches of 200
    for (let i = 0; i < allGames.length; i += 200) {
      const batch = allGames.slice(i, i + 200);
      const { error } = await supabase.from("games").upsert(batch, { onConflict: "game_id" });
      if (error) {
        console.error(`Error inserting batch ${i}:`, error);
      } else {
        totalInserted += batch.length;
      }
    }

    console.log(`[SYNC-GAMES] Upserted ${totalInserted} rows successfully`);
    revalidatePath("/calendrier");
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC-GAMES] Completed at ${now} (took ${duration}s)`);

    return NextResponse.json({
      ok: true,
      totalGames: allGames.length,
      inserted: totalInserted,
      timestamp: now,
    });
  } catch (err) {
    console.error("Error syncing games:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
