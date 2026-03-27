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
  resultSets: { headers: string[]; rowSet: (string | number | null)[][] }[];
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
        try { resolve(JSON.parse(data)); } catch { reject(new Error("Parse error")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface CareerRow {
  player_id: number;
  season: string;
  team: string;
  gp: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
  updated_at: string;
}

async function fetchPlayerCareer(playerId: number): Promise<CareerRow[]> {
  const data = await fetchNba(
    `https://stats.nba.com/stats/playercareerstats?LeagueID=00&PerMode=PerGame&PlayerID=${playerId}`
  );

  const rs = data.resultSets.find((r) => r.headers.includes("SEASON_ID"));
  if (!rs) return [];

  const h = rs.headers;
  const ii = (name: string) => h.indexOf(name);
  const now = new Date().toISOString();

  return rs.rowSet.map((row) => ({
    player_id: playerId,
    season: String(row[ii("SEASON_ID")] || ""),
    team: String(row[ii("TEAM_ABBREVIATION")] || ""),
    gp: Number(row[ii("GP")] || 0),
    min: Number(row[ii("MIN")] || 0),
    pts: Number(row[ii("PTS")] || 0),
    reb: Number(row[ii("REB")] || 0),
    ast: Number(row[ii("AST")] || 0),
    stl: Number(row[ii("STL")] || 0),
    blk: Number(row[ii("BLK")] || 0),
    fg_pct: Number(row[ii("FG_PCT")] || 0),
    fg3_pct: Number(row[ii("FG3_PCT")] || 0),
    ft_pct: Number(row[ii("FT_PCT")] || 0),
    updated_at: now,
  }));
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

  // Optional: sync a single player
  const singleId = request.nextUrl.searchParams.get("player_id");
  if (singleId && /^\d+$/.test(singleId)) {
    try {
      const rows = await fetchPlayerCareer(Number(singleId));
      if (rows.length > 0) {
        await supabase.from("player_career_stats").delete().eq("player_id", Number(singleId));
        await supabase.from("player_career_stats").insert(rows);
      }
      return NextResponse.json({ ok: true, player_id: singleId, seasons: rows.length });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 502 });
    }
  }

  // Bulk: sync all active players
  const { data: activePlayers } = await supabase
    .from("players")
    .select("player_id")
    .eq("is_active", true);

  if (!activePlayers || activePlayers.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, message: "No active players" });
  }

  let synced = 0;
  let failed = 0;
  const allRows: CareerRow[] = [];

  for (let i = 0; i < activePlayers.length; i++) {
    const pid = activePlayers[i].player_id;
    try {
      const rows = await fetchPlayerCareer(pid);
      allRows.push(...rows);
      synced++;
    } catch {
      failed++;
    }

    // Rate limiting: ~1 request per 700ms to avoid NBA API throttling
    if (i < activePlayers.length - 1) {
      await sleep(700);
    }

    // Insert in batches to avoid memory buildup
    if (allRows.length >= BATCH_SIZE * 5) {
      await supabase.from("player_career_stats").upsert(allRows, {
        onConflict: "player_id,season,team",
      });
      allRows.length = 0;
    }
  }

  // Insert remaining
  if (allRows.length > 0) {
    await supabase.from("player_career_stats").upsert(allRows, {
      onConflict: "player_id,season,team",
    });
  }

  return NextResponse.json({
    ok: true,
    total: activePlayers.length,
    synced,
    failed,
  });
}
