import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

interface NbaBoxscoreResponse {
  game: {
    gameId: string;
    gameStatus: number;
    gameStatusText: string;
    homeTeam: NbaTeam;
    awayTeam: NbaTeam;
  };
}

interface NbaTeam {
  teamTricode: string;
  teamName: string;
  teamCity: string;
  score: number;
  players: NbaPlayer[];
}

interface NbaPlayer {
  personId: number;
  name: string;
  nameI: string;
  jerseyNum: string;
  position: string;
  starter: string;
  oncourt: string;
  played: string;
  statistics: {
    minutes: string;
    points: number;
    reboundsTotal: number;
    reboundsOffensive: number;
    reboundsDefensive: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    foulsPersonal: number;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    threePointersMade: number;
    threePointersAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
    plusMinusPoints: number;
  };
}

function fetchBoxscore(gameId: string): Promise<NbaBoxscoreResponse> {
  const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`NBA CDN error: ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Failed to parse boxscore response"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("NBA CDN timeout"));
    });
  });
}

function parseMinutes(iso: string): string {
  // "PT32M45.00S" -> "32:45"
  const match = iso.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return "0:00";
  const m = match[1];
  const s = Math.floor(parseFloat(match[2]));
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildRows(gameId: string, team: NbaTeam, isHome: boolean, now: string) {
  return team.players
    .filter((p) => p.played === "1")
    .map((p) => ({
      game_id: gameId,
      player_id: p.personId,
      player_name: p.name,
      team: team.teamTricode,
      is_home: isHome,
      starter: p.starter === "1",
      position: p.position || null,
      jersey: p.jerseyNum || null,
      minutes: parseMinutes(p.statistics.minutes),
      pts: p.statistics.points,
      reb: p.statistics.reboundsTotal,
      oreb: p.statistics.reboundsOffensive,
      dreb: p.statistics.reboundsDefensive,
      ast: p.statistics.assists,
      stl: p.statistics.steals,
      blk: p.statistics.blocks,
      tov: p.statistics.turnovers,
      pf: p.statistics.foulsPersonal,
      fgm: p.statistics.fieldGoalsMade,
      fga: p.statistics.fieldGoalsAttempted,
      fg3m: p.statistics.threePointersMade,
      fg3a: p.statistics.threePointersAttempted,
      ftm: p.statistics.freeThrowsMade,
      fta: p.statistics.freeThrowsAttempted,
      plus_minus: p.statistics.plusMinusPoints,
      updated_at: now,
    }));
}

export async function GET(request: NextRequest) {
  const gameId = request.nextUrl.searchParams.get("gameId");
  if (!gameId) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check if already synced
  const { count } = await supabase
    .from("boxscores")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId);

  if (count && count > 0) {
    return NextResponse.json({ ok: true, cached: true, gameId });
  }

  try {
    const data = await fetchBoxscore(gameId);
    const game = data.game;
    const now = new Date().toISOString();

    const rows = [
      ...buildRows(gameId, game.homeTeam, true, now),
      ...buildRows(gameId, game.awayTeam, false, now),
    ];

    if (rows.length === 0) {
      return NextResponse.json({ error: "No player data in boxscore" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("boxscores").insert(rows as any);
    if (error) {
      console.error("Boxscore insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, gameId, players: rows.length });
  } catch (err) {
    console.error("Boxscore fetch error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
