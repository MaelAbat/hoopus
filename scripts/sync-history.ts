/**
 * Historical backfill script: fetch games + standings for past NBA seasons.
 * Only uses UPSERT — never deletes existing data.
 *
 * Usage:
 *   npm run sync:history                    # All seasons from 2015-16 to last completed
 *   npm run sync:history 2023-24            # Specific season
 *   npm run sync:history 2020-21 2022-23    # Multiple seasons
 */

import https from "node:https";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getCurrentSeason, seasonStartYear } from "../src/lib/season";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

const TRICODE_MAP: Record<string, string> = {
  GS: "GSW", NY: "NYK", SA: "SAS", NO: "NOP", WSH: "WAS", UTAH: "UTA",
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : require("http");
    const req = mod.get(url, { headers: headers || {} }, (res: any) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url.substring(0, 80)}...`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Parse error"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

/* ─── Games (NBA API leaguegamelog) ─── */

interface GameLogRow {
  SEASON_ID: string;
  TEAM_ID: number;
  TEAM_ABBREVIATION: string;
  TEAM_NAME: string;
  GAME_ID: string;
  GAME_DATE: string;
  MATCHUP: string;
  WL: string;
  PTS: number;
}

async function fetchGames(season: string, seasonType: string): Promise<GameLogRow[]> {
  const url =
    `https://stats.nba.com/stats/leaguegamelog?Counter=0&DateFrom=&DateTo=&Direction=DESC&LeagueID=00&PlayerOrTeam=T&Season=${season}&SeasonType=${encodeURIComponent(seasonType)}&Sorter=DATE`;

  const data = await fetchJson(url, NBA_HEADERS);
  const rs = data.resultSets[0];
  const h = rs.headers as string[];
  const ii = (name: string) => h.indexOf(name);

  return rs.rowSet.map((row: any[]) => ({
    SEASON_ID: String(row[ii("SEASON_ID")] || ""),
    TEAM_ID: Number(row[ii("TEAM_ID")] || 0),
    TEAM_ABBREVIATION: String(row[ii("TEAM_ABBREVIATION")] || ""),
    TEAM_NAME: String(row[ii("TEAM_NAME")] || ""),
    GAME_ID: String(row[ii("GAME_ID")] || ""),
    GAME_DATE: String(row[ii("GAME_DATE")] || ""),
    MATCHUP: String(row[ii("MATCHUP")] || ""),
    WL: String(row[ii("WL")] || ""),
    PTS: Number(row[ii("PTS")] || 0),
  }));
}

function buildGameRows(logs: GameLogRow[], season: string) {
  // Group by GAME_ID — each game has 2 rows (one per team)
  const byGame = new Map<string, GameLogRow[]>();
  for (const row of logs) {
    const list = byGame.get(row.GAME_ID) || [];
    list.push(row);
    byGame.set(row.GAME_ID, list);
  }

  const now = new Date().toISOString();
  const games: any[] = [];

  for (const [gameId, rows] of byGame) {
    if (rows.length < 2) continue;

    // "vs." = home team, "@" = away team
    const homeRow = rows.find((r) => r.MATCHUP.includes("vs."));
    const awayRow = rows.find((r) => r.MATCHUP.includes("@"));
    if (!homeRow || !awayRow) continue;

    games.push({
      game_id: gameId,
      game_date: homeRow.GAME_DATE.split("T")[0],
      game_time: "",
      status: 3, // historical = final
      status_text: "Final",
      home_team: homeRow.TEAM_ABBREVIATION,
      home_team_name: homeRow.TEAM_NAME,
      home_score: homeRow.PTS,
      away_team: awayRow.TEAM_ABBREVIATION,
      away_team_name: awayRow.TEAM_NAME,
      away_score: awayRow.PTS,
      arena: "",
      arena_city: "",
      season,
      updated_at: now,
    });
  }

  return games;
}

async function syncGamesForSeason(season: string): Promise<number> {
  console.log(`    Matchs saison reguliere...`);
  const regularLogs = await fetchGames(season, "Regular Season");
  await sleep(2000);

  console.log(`    Matchs playoffs...`);
  let playoffLogs: GameLogRow[] = [];
  try {
    playoffLogs = await fetchGames(season, "Playoffs");
  } catch {
    console.log(`    (pas de playoffs disponibles)`);
  }

  const allLogs = [...regularLogs, ...playoffLogs];
  const games = buildGameRows(allLogs, season);

  if (games.length === 0) {
    console.log(`    Aucun match trouve`);
    return 0;
  }

  // Upsert in batches
  const BATCH = 200;
  let upserted = 0;
  for (let i = 0; i < games.length; i += BATCH) {
    const batch = games.slice(i, i + BATCH);
    const { error } = await supabase.from("games").upsert(batch, { onConflict: "game_id" });
    if (error) {
      console.log(`    Erreur batch ${i}: ${error.message}`);
    } else {
      upserted += batch.length;
    }
  }

  console.log(`    ${upserted} matchs inseres/mis a jour`);
  return upserted;
}

/* ─── Standings (ESPN API) ─── */

async function syncStandingsForSeason(season: string): Promise<number> {
  const espnYear = seasonStartYear(season) + 1;
  const url = `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${espnYear}`;

  console.log(`    Classement (ESPN ${espnYear})...`);
  let response: any;
  try {
    response = await fetchJson(url);
  } catch (err) {
    console.log(`    Erreur: ${(err as Error).message}`);
    return 0;
  }

  if (!response.children || response.children.length === 0) {
    console.log(`    Pas de donnees`);
    return 0;
  }

  const now = new Date().toISOString();

  const standings = response.children.flatMap((conference: any) => {
    const confName = conference.abbreviation === "East" ? "East" : "West";
    return conference.standings.entries.map((entry: any) => {
      const { team, stats } = entry;
      const getStat = (name: string) => stats.find((s: any) => s.name === name);

      return {
        conference: confName,
        team_tricode: TRICODE_MAP[team.abbreviation] || team.abbreviation,
        team_name: team.name,
        team_city: team.location,
        wins: getStat("wins")?.value ?? 0,
        losses: getStat("losses")?.value ?? 0,
        win_pct: getStat("winPercent")?.value ?? 0,
        home_record: getStat("Home")?.summary ?? "0-0",
        road_record: getStat("Road")?.summary ?? "0-0",
        last_10: getStat("Last Ten Games")?.summary ?? "0-0",
        streak: getStat("streak")?.displayValue ?? "",
        conference_rank: getStat("playoffSeed")?.value ?? 0,
        season,
        updated_at: now,
      };
    });
  });

  if (standings.length === 0) {
    console.log(`    Aucune equipe trouvee`);
    return 0;
  }

  const { error } = await supabase.from("standings").upsert(standings, { onConflict: "team_tricode,season" });
  if (error) {
    console.log(`    Erreur: ${error.message}`);
    return 0;
  }

  console.log(`    ${standings.length} equipes inserees/mises a jour`);
  return standings.length;
}

/* ─── Main ─── */

function generateSeasons(fromYear: number, toYear: number): string[] {
  const seasons: string[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    const end = (y + 1) % 100;
    seasons.push(`${y}-${end.toString().padStart(2, "0")}`);
  }
  return seasons;
}

async function main() {
  const args = process.argv.slice(2);
  const current = getCurrentSeason();
  const currentStartYear = seasonStartYear(current);

  let seasons: string[];
  if (args.length > 0) {
    seasons = args;
  } else {
    // Default: from 2015-16 to the season before current
    seasons = generateSeasons(2015, currentStartYear - 1);
  }

  // Filter out current season (use regular sync for that)
  seasons = seasons.filter((s) => s !== current);

  if (seasons.length === 0) {
    console.log("\n  Aucune saison a synchroniser.\n");
    process.exit(0);
  }

  console.log(`\n  Sync historique — ${seasons.length} saison(s)\n`);
  console.log(`  Saisons: ${seasons.join(", ")}\n`);

  const startTime = Date.now();
  let totalGames = 0;
  let totalStandings = 0;

  for (let i = 0; i < seasons.length; i++) {
    const season = seasons[i];
    console.log(`  [${i + 1}/${seasons.length}] ${season}`);

    // Games
    try {
      const games = await syncGamesForSeason(season);
      totalGames += games;
    } catch (err) {
      console.log(`    Erreur matchs: ${(err as Error).message}`);
    }

    await sleep(3000);

    // Standings
    try {
      const standings = await syncStandingsForSeason(season);
      totalStandings += standings;
    } catch (err) {
      console.log(`    Erreur classement: ${(err as Error).message}`);
    }

    await sleep(2000);
    console.log("");
  }

  const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`  Termine en ${totalMin} minutes`);
  console.log(`  ${totalGames} matchs, ${totalStandings} classements inseres/mis a jour\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
