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
    req.setTimeout(300000, () => { req.destroy(); reject(new Error("Timeout")); });
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
  await sleep(2000);

  console.log(`    Matchs play-in...`);
  let playinLogs: GameLogRow[] = [];
  try {
    playinLogs = await fetchGames(season, "PlayIn");
  } catch {
    console.log(`    (pas de play-in disponible)`);
  }

  const allLogs = [...regularLogs, ...playoffLogs, ...playinLogs];
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

/* ─── Stats (NBA API leaguedashplayerstats) ─── */

async function fetchPlayerStats(season: string, perMode: string, measureType: string): Promise<any> {
  const url =
    `https://stats.nba.com/stats/leaguedashplayerstats?` +
    `Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&ISTRound=` +
    `&LastNGames=0&LeagueID=00&Location=&MeasureType=${measureType}&Month=0&OpponentTeamID=0` +
    `&Outcome=&PORound=0&PaceAdjust=N&PerMode=${perMode}&Period=0&PlayerExperience=` +
    `&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}` +
    `&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=` +
    `&TeamID=0&TwoWay=0&VsConference=&VsDivision=&Weight=`;

  return fetchJson(url, NBA_HEADERS);
}

async function syncStatsForSeason(season: string): Promise<number> {
  console.log(`    Stats joueurs (3 appels API)...`);

  let baseData: any, perGameData: any, advData: any;
  try {
    baseData = await fetchPlayerStats(season, "Totals", "Base");
    await sleep(2000);
    perGameData = await fetchPlayerStats(season, "PerGame", "Base");
    await sleep(2000);
    advData = await fetchPlayerStats(season, "PerGame", "Advanced");
  } catch (err) {
    console.log(`    Erreur API: ${(err as Error).message}`);
    return 0;
  }

  const headers = baseData.resultSets[0].headers as string[];
  const rows = baseData.resultSets[0].rowSet;
  const pgHeaders = perGameData.resultSets[0].headers as string[];
  const pgRows = perGameData.resultSets[0].rowSet;
  const advHeaders = advData.resultSets[0].headers as string[];
  const advRows = advData.resultSets[0].rowSet;

  const idx = (h: string[], name: string) => h.indexOf(name);
  const now = new Date().toISOString();

  // Index per-game and advanced data by player_id
  const pgByPlayer = new Map<number, any[]>();
  for (const row of pgRows) pgByPlayer.set(Number(row[idx(pgHeaders, "PLAYER_ID")]), row);
  const advByPlayer = new Map<number, any[]>();
  for (const row of advRows) advByPlayer.set(Number(row[idx(advHeaders, "PLAYER_ID")]), row);

  // Categories to extract
  const PG_CATS = ["PTS", "REB", "AST", "BLK", "STL", "TOV", "MIN", "OREB", "DREB"];
  const ADV_CATS: { cat: string; field: string; isPct: boolean }[] = [
    { cat: "USG_PCT", field: "USG_PCT", isPct: true },
    { cat: "OFF_RATING", field: "OFF_RATING", isPct: false },
    { cat: "DEF_RATING", field: "DEF_RATING", isPct: false },
    { cat: "NET_RATING", field: "NET_RATING", isPct: false },
    { cat: "AST_PCT", field: "AST_PCT", isPct: true },
    { cat: "OREB_PCT", field: "OREB_PCT", isPct: true },
    { cat: "DREB_PCT", field: "DREB_PCT", isPct: true },
    { cat: "REB_PCT", field: "REB_PCT", isPct: true },
    { cat: "PACE", field: "PACE", isPct: false },
    { cat: "PIE", field: "PIE", isPct: true },
  ];

  const MIN_GP = 40;
  const playerIdIdx = idx(headers, "PLAYER_ID");
  const playerNameIdx = idx(headers, "PLAYER_NAME");
  const teamIdx = idx(headers, "TEAM_ABBREVIATION");
  const gpIdx = idx(headers, "GP");
  const fgmIdx = idx(headers, "FGM");
  const fgaIdx = idx(headers, "FGA");
  const fg3mIdx = idx(headers, "FG3M");
  const fg3aIdx = idx(headers, "FG3A");
  const ftmIdx = idx(headers, "FTM");
  const ftaIdx = idx(headers, "FTA");
  const ptsIdx = idx(headers, "PTS");

  const allLeaders: any[] = [];

  // Per-game categories (computed from totals for full precision)
  for (const cat of PG_CATS) {
    const totalStatIdx = idx(headers, cat);
    const players = rows.map((row: any[]) => {
      const pid = Number(row[playerIdIdx]);
      const gp = Number(row[gpIdx]);
      const total = totalStatIdx !== -1 ? Number(row[totalStatIdx]) : 0;
      const val = gp > 0 ? total / gp : 0;
      return { pid, name: String(row[playerNameIdx]), team: String(row[teamIdx]), gp, val };
    }).sort((a: any, b: any) => b.val - a.val);

    const eligible = players.filter((p: any) => p.gp >= MIN_GP);
    const eligibleCount = eligible.length;

    // Metadata row
    allLeaders.push({ category: cat, rank: 0, player_name: "__eligible_count__", player_id: 0, team: "", value: eligibleCount, season, updated_at: now });

    // All players ranked
    const sorted = [...eligible, ...players.filter((p: any) => p.gp < MIN_GP)];
    sorted.forEach((p: any, i: number) => {
      allLeaders.push({ category: cat, rank: i + 1, player_name: p.name, player_id: p.pid, team: p.team, value: p.val, season, updated_at: now });
    });
  }

  // GP category
  const gpPlayers = rows.map((row: any[]) => ({
    pid: Number(row[playerIdIdx]), name: String(row[playerNameIdx]), team: String(row[teamIdx]), val: Number(row[gpIdx]),
  })).sort((a: any, b: any) => b.val - a.val);
  allLeaders.push({ category: "GP", rank: 0, player_name: "__eligible_count__", player_id: 0, team: "", value: gpPlayers.filter((p: any) => p.val >= MIN_GP).length, season, updated_at: now });
  gpPlayers.forEach((p: any, i: number) => {
    allLeaders.push({ category: "GP", rank: i + 1, player_name: p.name, player_id: p.pid, team: p.team, value: p.val, season, updated_at: now });
  });

  // Shooting percentages (from totals for precision)
  const shootingCats: { cat: string; num: (r: any[]) => number; den: (r: any[]) => number; minPerGame: number }[] = [
    { cat: "FG_PCT", num: r => Number(r[fgmIdx]), den: r => Number(r[fgaIdx]), minPerGame: 8 },
    { cat: "FG3_PCT", num: r => Number(r[fg3mIdx]), den: r => Number(r[fg3aIdx]), minPerGame: 3 },
    { cat: "FT_PCT", num: r => Number(r[ftmIdx]), den: r => Number(r[ftaIdx]), minPerGame: 2 },
  ];

  for (const sc of shootingCats) {
    const players = rows.filter((r: any[]) => sc.den(r) > 0).map((r: any[]) => {
      const gp = Number(r[gpIdx]);
      const val = (sc.num(r) / sc.den(r)) * 100;
      const perGame = gp > 0 ? sc.den(r) / gp : 0;
      return { pid: Number(r[playerIdIdx]), name: String(r[playerNameIdx]), team: String(r[teamIdx]), gp, val, eligible: gp >= MIN_GP && perGame >= sc.minPerGame };
    });
    const eligible = players.filter(p => p.eligible).sort((a, b) => b.val - a.val);
    const ineligible = players.filter(p => !p.eligible).sort((a, b) => b.val - a.val);
    allLeaders.push({ category: sc.cat, rank: 0, player_name: "__eligible_count__", player_id: 0, team: "", value: eligible.length, season, updated_at: now });
    [...eligible, ...ineligible].forEach((p, i) => {
      allLeaders.push({ category: sc.cat, rank: i + 1, player_name: p.name, player_id: p.pid, team: p.team, value: p.val, season, updated_at: now });
    });
  }

  // TS% and eFG%
  const tsPlayers = rows.filter((r: any[]) => Number(r[fgaIdx]) > 0).map((r: any[]) => {
    const pts = Number(r[ptsIdx]); const fga = Number(r[fgaIdx]); const fta = Number(r[ftaIdx]); const gp = Number(r[gpIdx]);
    return { pid: Number(r[playerIdIdx]), name: String(r[playerNameIdx]), team: String(r[teamIdx]), gp, val: (pts / (2 * (fga + 0.44 * fta))) * 100, eligible: gp >= MIN_GP && (gp > 0 ? fga / gp : 0) >= 8 };
  });
  const tsEligible = tsPlayers.filter(p => p.eligible).sort((a, b) => b.val - a.val);
  const tsIneligible = tsPlayers.filter(p => !p.eligible).sort((a, b) => b.val - a.val);
  allLeaders.push({ category: "TS_PCT", rank: 0, player_name: "__eligible_count__", player_id: 0, team: "", value: tsEligible.length, season, updated_at: now });
  [...tsEligible, ...tsIneligible].forEach((p, i) => {
    allLeaders.push({ category: "TS_PCT", rank: i + 1, player_name: p.name, player_id: p.pid, team: p.team, value: p.val, season, updated_at: now });
  });

  const efgPlayers = rows.filter((r: any[]) => Number(r[fgaIdx]) > 0).map((r: any[]) => {
    const fgm = Number(r[fgmIdx]); const fg3m = Number(r[fg3mIdx]); const fga = Number(r[fgaIdx]); const gp = Number(r[gpIdx]);
    return { pid: Number(r[playerIdIdx]), name: String(r[playerNameIdx]), team: String(r[teamIdx]), gp, val: ((fgm + 0.5 * fg3m) / fga) * 100, eligible: gp >= MIN_GP && (gp > 0 ? fga / gp : 0) >= 8 };
  });
  const efgEligible = efgPlayers.filter(p => p.eligible).sort((a, b) => b.val - a.val);
  const efgIneligible = efgPlayers.filter(p => !p.eligible).sort((a, b) => b.val - a.val);
  allLeaders.push({ category: "EFG_PCT", rank: 0, player_name: "__eligible_count__", player_id: 0, team: "", value: efgEligible.length, season, updated_at: now });
  [...efgEligible, ...efgIneligible].forEach((p, i) => {
    allLeaders.push({ category: "EFG_PCT", rank: i + 1, player_name: p.name, player_id: p.pid, team: p.team, value: p.val, season, updated_at: now });
  });

  // Advanced categories
  for (const ac of ADV_CATS) {
    const aFieldIdx = idx(advHeaders, ac.field);
    if (aFieldIdx === -1) continue;
    const players = rows.map((r: any[]) => {
      const pid = Number(r[playerIdIdx]);
      const advRow = advByPlayer.get(pid);
      if (!advRow) return null;
      let val = Number(advRow[aFieldIdx]);
      if (ac.isPct) val *= 100;
      return { pid, name: String(r[playerNameIdx]), team: String(r[teamIdx]), gp: Number(r[gpIdx]), val, eligible: Number(r[gpIdx]) >= MIN_GP };
    }).filter(Boolean) as any[];

    const eligible = players.filter((p: any) => p.eligible).sort((a: any, b: any) => b.val - a.val);
    const ineligible = players.filter((p: any) => !p.eligible).sort((a: any, b: any) => b.val - a.val);
    allLeaders.push({ category: ac.cat, rank: 0, player_name: "__eligible_count__", player_id: 0, team: "", value: eligible.length, season, updated_at: now });
    [...eligible, ...ineligible].forEach((p: any, i: number) => {
      allLeaders.push({ category: ac.cat, rank: i + 1, player_name: p.name, player_id: p.pid, team: p.team, value: p.val, season, updated_at: now });
    });
  }

  // Upsert in batches
  const BATCH = 200;
  let upserted = 0;
  for (let i = 0; i < allLeaders.length; i += BATCH) {
    const batch = allLeaders.slice(i, i + BATCH);
    const { error } = await supabase.from("stat_leaders").upsert(batch, { onConflict: "category,player_name,season" });
    if (error) console.log(`    Erreur batch stats ${i}: ${error.message}`);
    else upserted += batch.length;
  }

  console.log(`    ${upserted} lignes stats inserees/mises a jour (${new Set(allLeaders.map(l => l.category)).size} categories)`);
  return upserted;
}

/* ─── Rosters (NBA API commonteamroster) ─── */

async function syncRostersForSeason(season: string): Promise<number> {
  console.log(`    Effectifs (30 equipes)...`);

  // Get team list from standings
  const { data: teams } = await supabase
    .from("standings")
    .select("team_tricode, team_name, team_city")
    .eq("season", season);

  if (!teams || teams.length === 0) {
    console.log(`    Pas de classement, impossible de recuperer les effectifs`);
    return 0;
  }

  // Get team IDs from leaguestandingsv3 (maps TeamCity+TeamName to TeamID)
  const teamListUrl = `https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season=${season}&SeasonType=Regular+Season`;
  let teamListData: any;
  try {
    teamListData = await fetchJson(teamListUrl, NBA_HEADERS);
  } catch (err) {
    console.log(`    Erreur API team list: ${(err as Error).message}`);
    return 0;
  }

  const tlHeaders = teamListData.resultSets[0].headers as string[];
  const tlRows = teamListData.resultSets[0].rowSet;
  const tlIdx = (name: string) => tlHeaders.indexOf(name);

  // Map by team_name (from standings) to TeamID
  const teamIdMap = new Map<string, number>();
  for (const row of tlRows) {
    const city = String(row[tlIdx("TeamCity")]);
    const name = String(row[tlIdx("TeamName")]);
    const teamId = Number(row[tlIdx("TeamID")]);
    // Match by team_name from our standings table
    teamIdMap.set(name, teamId);
    // Also map city+name for fallback
    teamIdMap.set(`${city} ${name}`, teamId);
  }

  const now = new Date().toISOString();
  const allRosters: any[] = [];

  for (const team of teams) {
    const teamId = teamIdMap.get(team.team_name) || teamIdMap.get(`${team.team_city} ${team.team_name}`);
    if (!teamId) continue;

    const url = `https://stats.nba.com/stats/commonteamroster?LeagueID=00&Season=${season}&TeamID=${teamId}`;
    try {
      const data = await fetchJson(url, NBA_HEADERS);
      const rs = data.resultSets[0];
      const h = rs.headers as string[];
      const ii = (name: string) => h.indexOf(name);

      for (const row of rs.rowSet) {
        const fullName = String(row[ii("PLAYER")] || "");
        const parts = fullName.split(" ");
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ") || "";
        const school = row[ii("SCHOOL")] ? String(row[ii("SCHOOL")]) : "";

        allRosters.push({
          player_id: Number(row[ii("PLAYER_ID")]),
          first_name: firstName,
          last_name: lastName,
          team_tricode: team.team_tricode,
          team_name: team.team_name,
          team_city: team.team_city,
          jersey_number: row[ii("NUM")] != null ? String(row[ii("NUM")]) : "",
          position: row[ii("POSITION")] != null ? String(row[ii("POSITION")]) : "",
          height: row[ii("HEIGHT")] != null ? String(row[ii("HEIGHT")]) : "",
          weight: row[ii("WEIGHT")] != null ? String(row[ii("WEIGHT")]) : "",
          age: row[ii("AGE")] != null ? Number(row[ii("AGE")]) : null,
          college: school,
          country: "",
          season,
          updated_at: now,
        });
      }
    } catch {
      // Skip team on error
    }

    await sleep(1000);
  }

  if (allRosters.length === 0) {
    console.log(`    Aucun effectif trouve`);
    return 0;
  }

  // Enrich with draft info + country from playerindex
  await sleep(2000);
  try {
    const indexUrl =
      `https://stats.nba.com/stats/playerindex?College=&Conference=&Country=&DraftPick=&DraftRound=&DraftYear=` +
      `&Height=&Historical=1&LeagueID=00&Season=${season}&SeasonType=Regular+Season&TeamID=0&Weight=`;
    const indexData = await fetchJson(indexUrl, NBA_HEADERS);
    const ih = indexData.resultSets[0].headers as string[];
    const iIdx = (name: string) => ih.indexOf(name);
    const indexMap = new Map<number, any[]>();
    for (const row of indexData.resultSets[0].rowSet) {
      indexMap.set(Number(row[iIdx("PERSON_ID")]), row);
    }

    for (const r of allRosters) {
      const pRow = indexMap.get(r.player_id);
      if (!pRow) continue;
      r.country = pRow[iIdx("COUNTRY")] ? String(pRow[iIdx("COUNTRY")]) : "";
      r.draft_year = pRow[iIdx("DRAFT_YEAR")] ? Number(pRow[iIdx("DRAFT_YEAR")]) : null;
      r.draft_round = pRow[iIdx("DRAFT_ROUND")] ? Number(pRow[iIdx("DRAFT_ROUND")]) : null;
      r.draft_number = pRow[iIdx("DRAFT_NUMBER")] ? Number(pRow[iIdx("DRAFT_NUMBER")]) : null;
    }
  } catch {
    console.log(`    (infos draft/pays non disponibles)`);
  }

  // Enrich with per-game stats from stat_leaders already in DB
  const { data: ptsRows } = await supabase.from("stat_leaders").select("player_name, value").eq("season", season).eq("category", "PTS").gt("rank", 0);
  const { data: rebRows } = await supabase.from("stat_leaders").select("player_name, value").eq("season", season).eq("category", "REB").gt("rank", 0);
  const { data: astRows } = await supabase.from("stat_leaders").select("player_name, value").eq("season", season).eq("category", "AST").gt("rank", 0);

  const statMap = (rows: any[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows || []) m.set(r.player_name, Number(r.value));
    return m;
  };
  const ptsMap = statMap(ptsRows);
  const rebMap = statMap(rebRows);
  const astMap = statMap(astRows);

  for (const r of allRosters) {
    const fullName = `${r.first_name} ${r.last_name}`;
    r.pts = ptsMap.get(fullName) ?? null;
    r.reb = rebMap.get(fullName) ?? null;
    r.ast = astMap.get(fullName) ?? null;
  }

  // Upsert in batches
  const BATCH = 200;
  let upserted = 0;
  for (let i = 0; i < allRosters.length; i += BATCH) {
    const batch = allRosters.slice(i, i + BATCH);
    const { error } = await supabase.from("rosters").upsert(batch, { onConflict: "player_id,season" });
    if (error) console.log(`    Erreur batch roster ${i}: ${error.message}`);
    else upserted += batch.length;
  }

  console.log(`    ${upserted} joueurs inseres/mis a jour`);
  return upserted;
}

/* ─── Playoffs (derived from games + standings already in DB) ─── */

async function syncPlayoffsForSeason(season: string): Promise<number> {
  console.log(`    Playoffs (reconstruction depuis les matchs)...`);

  // 1. Get standings for seed/conference info
  const { data: standingsData } = await supabase
    .from("standings")
    .select("team_tricode, conference, conference_rank")
    .eq("season", season);

  if (!standingsData || standingsData.length === 0) {
    console.log(`    Pas de classement, impossible de reconstituer les playoffs`);
    return 0;
  }

  const teamInfo = new Map<string, { conference: string; seed: number }>();
  const eastTeams = new Set<string>();
  const westTeams = new Set<string>();
  for (const s of standingsData) {
    teamInfo.set(s.team_tricode, { conference: s.conference, seed: s.conference_rank });
    if (s.conference === "East") eastTeams.add(s.team_tricode);
    else westTeams.add(s.team_tricode);
  }

  // 2. Get playoff games from games table (game_id starting with "004")
  const { data: playoffGames } = await supabase
    .from("games")
    .select("game_id, game_date, home_team, away_team, home_score, away_score, status")
    .eq("season", season)
    .like("game_id", "004%")
    .order("game_date", { ascending: true });

  if (!playoffGames || playoffGames.length === 0) {
    console.log(`    Aucun match de playoffs trouve`);
    return 0;
  }

  // 3. Group into series
  const seriesMap = new Map<string, {
    round: number;
    conference: string | null;
    seedTop: number;
    seedBottom: number;
    teamTop: string;
    teamBottom: string;
    games: { game_number: number; home_team: string; away_team: string; home_score: number; away_score: number; status: number; game_date: string }[];
  }>();

  for (const game of playoffGames) {
    // Extract round from game_id: "004XXYY..." → chars 6-7 = round
    const roundStr = game.game_id.substring(6, 8);
    const round = parseInt(roundStr, 10) || 1;

    const home = game.home_team;
    const away = game.away_team;
    const [t1, t2] = [home, away].sort();
    const key = `${round}-${t1}-${t2}`;

    if (!seriesMap.has(key)) {
      const homeInfo = teamInfo.get(home);
      const awayInfo = teamInfo.get(away);
      const homeSeed = homeInfo?.seed ?? 99;
      const awaySeed = awayInfo?.seed ?? 99;
      const isHomeHigher = homeSeed <= awaySeed;

      let conference: string | null = null;
      if (round < 4) {
        if (eastTeams.has(home) || eastTeams.has(away)) conference = "East";
        else if (westTeams.has(home) || westTeams.has(away)) conference = "West";
      }

      seriesMap.set(key, {
        round,
        conference,
        seedTop: isHomeHigher ? homeSeed : awaySeed,
        seedBottom: isHomeHigher ? awaySeed : homeSeed,
        teamTop: isHomeHigher ? home : away,
        teamBottom: isHomeHigher ? away : home,
        games: [],
      });
    }

    const series = seriesMap.get(key)!;
    series.games.push({
      game_number: series.games.length + 1,
      home_team: home,
      away_team: away,
      home_score: game.home_score,
      away_score: game.away_score,
      status: game.status,
      game_date: typeof game.game_date === "string" ? game.game_date.split("T")[0] : String(game.game_date),
    });
  }

  // 4. Compute wins and build rows
  const now = new Date().toISOString();
  const rows: any[] = [];

  for (const series of seriesMap.values()) {
    series.games.sort((a, b) => a.game_date.localeCompare(b.game_date));
    // Re-number after sorting by date
    series.games.forEach((g, i) => { g.game_number = i + 1; });

    let winsTop = 0;
    let winsBottom = 0;
    for (const g of series.games) {
      if (g.status === 3) {
        const winner = g.home_score > g.away_score ? g.home_team : g.away_team;
        if (winner === series.teamTop) winsTop++;
        else winsBottom++;
      }
    }

    rows.push({
      season,
      round: series.round,
      conference: series.conference,
      seed_top: series.seedTop,
      seed_bottom: series.seedBottom,
      team_top: series.teamTop,
      team_bottom: series.teamBottom,
      wins_top: winsTop,
      wins_bottom: winsBottom,
      status: (winsTop === 4 || winsBottom === 4) ? "completed" : "active",
      games: series.games,
      updated_at: now,
    });
  }

  if (rows.length === 0) {
    console.log(`    Aucune serie reconstituee`);
    return 0;
  }

  const { error } = await supabase.from("playoff_series").upsert(rows, {
    onConflict: "season,round,team_top,team_bottom",
  });
  if (error) {
    console.log(`    Erreur: ${error.message}`);
    return 0;
  }

  console.log(`    ${rows.length} series inserees/mises a jour`);

  // 5. Play-in games (game_id starting with "005" from leaguegamelog, exists since 2020-21)
  const { data: playinGamesData } = await supabase
    .from("games")
    .select("game_id, game_date, home_team, away_team, home_score, away_score, status")
    .eq("season", season)
    .like("game_id", "005%")
    .order("game_date", { ascending: true });

  if (playinGamesData && playinGamesData.length > 0) {
    const playinRows: any[] = [];

    for (const game of playinGamesData) {
      const home = game.home_team;
      const away = game.away_team;
      const homeInfo = teamInfo.get(home);
      const awayInfo = teamInfo.get(away);
      if (!homeInfo || !awayInfo) continue;
      if (homeInfo.conference !== awayInfo.conference) continue;

      // Determine matchup type from seeds
      const seeds = [homeInfo.seed, awayInfo.seed].sort((a, b) => a - b);
      let matchupType: string | null = null;
      if (seeds[0] === 7 && seeds[1] === 8) matchupType = "seven_eight";
      else if (seeds[0] === 9 && seeds[1] === 10) matchupType = "nine_ten";
      else if ((seeds[0] >= 7 && seeds[0] <= 8) && (seeds[1] >= 9 && seeds[1] <= 10)) matchupType = "final";
      if (!matchupType) continue;

      const finished = game.status === 3;
      const homeWon = finished && game.home_score > game.away_score;
      const awayWon = finished && game.away_score > game.home_score;

      playinRows.push({
        season,
        conference: homeInfo.conference,
        matchup_type: matchupType,
        home_team: home,
        away_team: away,
        home_seed: homeInfo.seed,
        away_seed: awayInfo.seed,
        home_score: game.home_score || 0,
        away_score: game.away_score || 0,
        status: game.status,
        game_date: typeof game.game_date === "string" ? game.game_date.split("T")[0] : String(game.game_date),
        winner: homeWon ? home : awayWon ? away : null,
        updated_at: now,
      });
    }

    // Deduplicate: keep only one row per (conference, matchup_type) — last one wins
    const deduped = new Map<string, any>();
    for (const r of playinRows) {
      deduped.set(`${r.conference}-${r.matchup_type}`, r);
    }
    const uniquePlayin = [...deduped.values()];

    if (uniquePlayin.length > 0) {
      const { error: piErr } = await supabase.from("playin_games").upsert(uniquePlayin, {
        onConflict: "season,conference,matchup_type",
      });
      if (piErr) console.log(`    Erreur play-in: ${piErr.message}`);
      else console.log(`    ${uniquePlayin.length} matchs play-in inseres/mis a jour`);
    }
  }

  return rows.length;
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
  let totalPlayoffs = 0;
  let totalStats = 0;
  let totalRosters = 0;

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
    await sleep(5000);

    // Standings
    try {
      const standings = await syncStandingsForSeason(season);
      totalStandings += standings;
    } catch (err) {
      console.log(`    Erreur classement: ${(err as Error).message}`);
    }
    await sleep(2000);

    // Playoffs (derived from games + standings already inserted above)
    try {
      const playoffs = await syncPlayoffsForSeason(season);
      totalPlayoffs += playoffs;
    } catch (err) {
      console.log(`    Erreur playoffs: ${(err as Error).message}`);
    }
    await sleep(5000);

    // Stats
    try {
      const stats = await syncStatsForSeason(season);
      totalStats += stats;
    } catch (err) {
      console.log(`    Erreur stats: ${(err as Error).message}`);
    }
    await sleep(5000);

    // Rosters
    try {
      const rosters = await syncRostersForSeason(season);
      totalRosters += rosters;
    } catch (err) {
      console.log(`    Erreur effectifs: ${(err as Error).message}`);
    }
    await sleep(5000);

    console.log("");
  }

  const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`  Termine en ${totalMin} minutes`);
  console.log(`  ${totalGames} matchs, ${totalStandings} classements, ${totalPlayoffs} series`);
  console.log(`  ${totalStats} stats, ${totalRosters} effectifs inseres/mis a jour\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
