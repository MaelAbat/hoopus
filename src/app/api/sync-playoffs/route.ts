import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";

/*
  NBA gameId format for playoffs: "004XXYYZZ"
  - 004 = playoff prefix
  - XX = season suffix (26 for 2025-26)
  - YY = round: 01=first round, 02=conf semis, 03=conf finals, 04=finals
  - ZZ = series + game info

  We parse the round from gameId chars [6..8] → "01","02","03","04"
*/

const EAST_TEAMS = new Set<string>();
const WEST_TEAMS = new Set<string>();

interface NbaTeam {
  teamTricode: string;
  teamName: string;
  teamCity: string;
  score: number;
  wins: number;
  losses: number;
  seed: number;
}

interface NbaGame {
  gameId: string;
  gameDateEst: string;
  gameTimeEst: string;
  gameStatus: number;        // 1=scheduled, 2=in progress, 3=final
  gameStatusText: string;
  homeTeam: NbaTeam;
  awayTeam: NbaTeam;
  seriesGameNumber: string;  // "1","2", etc.
  seriesText: string;        // "BOS leads 2-1", "Series tied 1-1", etc.
  ifNecessary: boolean;
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
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error("CDN timeout"));
    });
  });
}

function getRound(gameId: string): number {
  // gameId format: 004XXYYZZ... → chars at index 6-7 are the round
  const roundStr = gameId.substring(6, 8);
  return parseInt(roundStr, 10) || 1;
}

interface SeriesKey {
  round: number;
  teamA: string;
  teamB: string;
}

interface SeriesData {
  round: number;
  conference: string | null;
  seedTop: number;
  seedBottom: number;
  teamTop: string;
  teamBottom: string;
  winsTop: number;
  winsBottom: number;
  status: "upcoming" | "active" | "completed";
  games: {
    game_number: number;
    home_team: string;
    away_team: string;
    home_score: number;
    away_score: number;
    status: number;
    game_date: string;
  }[];
}

interface StandingRow {
  team_tricode: string;
  conference: string;
  conference_rank: number;
}

const TEAM_SEEDS = new Map<string, { conference: string; seed: number }>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchConferenceTeams(supabase: any) {
  const { data } = await supabase
    .from("standings")
    .select("team_tricode, conference, conference_rank")
    .eq("season", SEASON);

  const standings = data as StandingRow[] | null;
  if (standings) {
    for (const s of standings) {
      if (s.conference === "East") EAST_TEAMS.add(s.team_tricode);
      else WEST_TEAMS.add(s.team_tricode);
      TEAM_SEEDS.set(s.team_tricode, { conference: s.conference, seed: s.conference_rank });
    }
  }
}

function getPlayInMatchupType(seedA: number, seedB: number): string | null {
  const seeds = [seedA, seedB].sort((a, b) => a - b);
  if (seeds[0] === 7 && seeds[1] === 8) return "seven_eight";
  if (seeds[0] === 9 && seeds[1] === 10) return "nine_ten";
  // Final play-in: loser of 7v8 vs winner of 9v10 — one seed is 7/8, other is 9/10
  if ((seeds[0] >= 7 && seeds[0] <= 8) && (seeds[1] >= 9 && seeds[1] <= 10)) return "final";
  return null;
}

function getConference(teamA: string, teamB: string, round: number): string | null {
  if (round === 4) return null; // NBA Finals
  if (EAST_TEAMS.has(teamA) || EAST_TEAMS.has(teamB)) return "East";
  if (WEST_TEAMS.has(teamA) || WEST_TEAMS.has(teamB)) return "West";
  return null;
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

  try {
    const now = new Date().toISOString();
    await fetchConferenceTeams(supabase);
    const schedule = await fetchSchedule();
    const gameDates = schedule.leagueSchedule.gameDates;

    // Collect all playoff and play-in games
    const playoffGames: NbaGame[] = [];
    const playinGames: NbaGame[] = [];
    for (const dateEntry of gameDates) {
      for (const game of dateEntry.games) {
        if (game.gameId.startsWith("004")) {
          playoffGames.push(game);
        } else if (game.gameId.startsWith("003")) {
          playinGames.push(game);
        }
      }
    }

    // ─── Process Play-In games ───
    const playinRows = [];
    for (const game of playinGames) {
      const home = game.homeTeam.teamTricode;
      const away = game.awayTeam.teamTricode;
      const homeInfo = TEAM_SEEDS.get(home);
      const awayInfo = TEAM_SEEDS.get(away);
      if (!homeInfo || !awayInfo) continue;
      // Only process games where both teams are from the same conference
      if (homeInfo.conference !== awayInfo.conference) continue;

      const matchupType = getPlayInMatchupType(homeInfo.seed, awayInfo.seed);
      if (!matchupType) continue;

      const finished = game.gameStatus === 3;
      const homeWon = finished && (game.homeTeam.score > game.awayTeam.score);
      const awayWon = finished && (game.awayTeam.score > game.homeTeam.score);

      playinRows.push({
        season: SEASON,
        conference: homeInfo.conference,
        matchup_type: matchupType,
        home_team: home,
        away_team: away,
        home_seed: homeInfo.seed,
        away_seed: awayInfo.seed,
        home_score: game.homeTeam.score || 0,
        away_score: game.awayTeam.score || 0,
        status: game.gameStatus,
        game_date: game.gameDateEst?.split("T")[0] || "",
        winner: homeWon ? home : awayWon ? away : null,
        updated_at: now,
      });
    }

    // Upsert play-in games
    await supabase.from("playin_games").delete().eq("season", SEASON);
    if (playinRows.length > 0) {
      const { error: playinError } = await supabase.from("playin_games").insert(playinRows);
      if (playinError) {
        console.error("Error inserting play-in games:", playinError);
      }
    }

    // ─── Process Playoff series ───
    if (playoffGames.length === 0 && playinRows.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No playoff or play-in games found yet",
        series: 0,
        playin: 0,
        timestamp: now,
      });
    }

    // Group games by series (unique combination of round + two teams)
    const seriesMap = new Map<string, SeriesData>();

    for (const game of playoffGames) {
      const round = getRound(game.gameId);
      const home = game.homeTeam.teamTricode;
      const away = game.awayTeam.teamTricode;

      // Consistent key: sort team names so both directions map to same series
      const [t1, t2] = [home, away].sort();
      const key = `${round}-${t1}-${t2}`;

      if (!seriesMap.has(key)) {
        // Determine higher seed (lower number = higher seed)
        const homeSeed = game.homeTeam.seed || 99;
        const awaySeed = game.awayTeam.seed || 99;
        const isHomeHigher = homeSeed <= awaySeed;

        seriesMap.set(key, {
          round,
          conference: getConference(home, away, round),
          seedTop: isHomeHigher ? homeSeed : awaySeed,
          seedBottom: isHomeHigher ? awaySeed : homeSeed,
          teamTop: isHomeHigher ? home : away,
          teamBottom: isHomeHigher ? away : home,
          winsTop: 0,
          winsBottom: 0,
          status: "upcoming",
          games: [],
        });
      }

      const series = seriesMap.get(key)!;
      const gameNumber = parseInt(game.seriesGameNumber, 10) || series.games.length + 1;

      series.games.push({
        game_number: gameNumber,
        home_team: home,
        away_team: away,
        home_score: game.homeTeam.score || 0,
        away_score: game.awayTeam.score || 0,
        status: game.gameStatus,
        game_date: game.gameDateEst?.split("T")[0] || "",
      });
    }

    // Compute wins and status for each series
    const rows = [];

    for (const series of seriesMap.values()) {
      // Sort games by game number
      series.games.sort((a, b) => a.game_number - b.game_number);

      let winsTop = 0;
      let winsBottom = 0;
      let hasActive = false;

      for (const g of series.games) {
        if (g.status === 3) {
          // Game finished
          const homeWon = g.home_score > g.away_score;
          const winner = homeWon ? g.home_team : g.away_team;
          if (winner === series.teamTop) winsTop++;
          else winsBottom++;
        } else if (g.status === 2) {
          hasActive = true;
        }
      }

      let status: "upcoming" | "active" | "completed" = "upcoming";
      if (winsTop === 4 || winsBottom === 4) {
        status = "completed";
      } else if (winsTop > 0 || winsBottom > 0 || hasActive) {
        status = "active";
      }

      rows.push({
        season: SEASON,
        round: series.round,
        conference: series.conference,
        seed_top: series.seedTop,
        seed_bottom: series.seedBottom,
        team_top: series.teamTop,
        team_bottom: series.teamBottom,
        wins_top: winsTop,
        wins_bottom: winsBottom,
        status,
        games: series.games,
        updated_at: now,
      });
    }

    // Filter out series with undefined teams (e.g. Finals not yet determined)
    const validRows = rows.filter(r => r.team_top && r.team_bottom);

    // Clear and reinsert
    await supabase.from("playoff_series").delete().eq("season", SEASON);

    if (validRows.length > 0) {
      const { error } = await supabase.from("playoff_series").insert(validRows);
      if (error) {
        console.error("Error inserting playoff series:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    revalidatePath("/playoffs");
    console.log(`[SYNC-PLAYOFFS] Completed at ${now}`);

    return NextResponse.json({
      ok: true,
      series: validRows.length,
      skipped: rows.length - validRows.length,
      playin: playinRows.length,
      timestamp: now,
    });
  } catch (err) {
    console.error("Error syncing playoffs:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
