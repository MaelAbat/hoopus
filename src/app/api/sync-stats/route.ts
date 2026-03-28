import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";
const BATCH_SIZE = 200;
const MIN_GP = 40;
const MIN_FG3A = 3;
const MIN_FGA = 8;
const MIN_FTA = 2;
const MIN_FG2A = 4;

const BR_YEAR = "2026"; // Basketball Reference uses end-year of season

// Basketball Reference tricode → NBA tricode
const TRICODE_MAP: Record<string, string> = {
  BRK: "BKN",
  CHO: "CHA",
  PHO: "PHX",
};

interface LeaderRow {
  category: string;
  rank: number;
  player_name: string;
  player_id: number;
  team: string;
  value: number;
  season: string;
  updated_at: string;
}

interface BRPlayer {
  name: string;
  team: string; // already mapped to NBA tricode
  stats: Record<string, number>;
}

/* ─── HTML fetching with redirect handling ─── */
function fetchHtml(url: string, redirects = 0): Promise<string> {
  if (redirects > 5) return Promise.reject(new Error("Too many redirects"));
  return new Promise((resolve, reject) => {
    try {
      const req = https.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          let location = res.headers.location;
          if (location.startsWith("/")) {
            const parsed = new URL(url);
            location = `${parsed.protocol}//${parsed.host}${location}`;
          }
          res.resume();
          fetchHtml(location, redirects + 1).then(resolve).catch(reject);
          return;
        }
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTML fetch error: ${res.statusCode} for ${url}`));
            return;
          }
          resolve(data);
        });
      });
      req.on("error", reject);
      req.setTimeout(120000, () => {
        req.destroy();
        reject(new Error(`HTML fetch timeout for ${url}`));
      });
    } catch (err) {
      reject(err);
    }
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapTricode(brTeam: string): string {
  const upper = brTeam.toUpperCase();
  return TRICODE_MAP[upper] || upper;
}

/**
 * Parse a Basketball Reference stats table.
 * Each player row is a <tr> containing <td data-stat="...">value</td> cells.
 * The player name is inside <td data-stat="player"><a ...>Name</a></td>.
 * The team is inside <td data-stat="team_id"><a ...>TM</a></td>.
 */
function parseBRTable(html: string): BRPlayer[] {
  const players: BRPlayer[] = [];

  // Basketball Reference wraps the main table in comments for some pages.
  // Uncomment any hidden tables: <!-- <div ...>...</div> -->
  const uncommented = html.replace(/<!--\s*([\s\S]*?)-->/g, "$1");

  // Match each player row: <tr ...>...</tr>
  // Skip header rows (they have <th> for all cells)
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(uncommented)) !== null) {
    const rowHtml = rowMatch[0];

    // Skip header rows and separator rows
    if (rowHtml.includes('class="thead"') || rowHtml.includes('class="over_header"')) continue;
    // Skip rows without data-stat="player"
    if (!rowHtml.includes('data-stat="player"')) continue;

    // Extract player name from <td data-stat="player"><a ...>Name</a></td>
    const nameMatch = rowHtml.match(/data-stat="player"[^>]*>(?:<[^>]*>)*([^<]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (!name) continue;

    // Extract team
    const teamMatch = rowHtml.match(/data-stat="team_id"[^>]*>(?:<a[^>]*>)?([^<]+)/);
    const brTeam = teamMatch ? teamMatch[1].trim() : "";
    // Skip "TOT" rows (players traded mid-season who appear multiple times)
    // We'll keep the TOT row if it exists (represents full season), but skip partial team rows
    // Actually, BR lists TOT first, then individual team rows. We want individual team rows
    // for team mapping, but TOT for stats. Let's keep all and deduplicate later.

    const team = mapTricode(brTeam);

    // Extract all data-stat values
    const stats: Record<string, number> = {};
    const cellRegex = /data-stat="([^"]+)"[^>]*>([^<]*)/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const [, statName, rawVal] = cellMatch;
      if (statName === "player" || statName === "team_id") continue;
      const val = parseFloat(rawVal);
      if (!isNaN(val)) {
        stats[statName] = val;
      }
    }

    // Must have at least a games played stat
    if (stats["g"] === undefined) continue;

    players.push({ name, team, stats });
  }

  return players;
}

/**
 * Deduplicate players: if a player has a "TOT" row (traded mid-season),
 * use their TOT stats but assign them to their most recent team.
 * BR lists TOT first, then individual team rows.
 */
function deduplicatePlayers(players: BRPlayer[]): BRPlayer[] {
  const seen = new Map<string, BRPlayer>();
  const lastTeam = new Map<string, string>();

  // First pass: find the last (most recent) team for each player
  for (const p of players) {
    if (p.team !== "TOT") {
      lastTeam.set(p.name, p.team);
    }
  }

  // Second pass: keep TOT rows with resolved team, or single-team rows
  for (const p of players) {
    const key = p.name;
    if (p.team === "TOT") {
      // Use TOT stats with the last known team
      const resolvedTeam = lastTeam.get(p.name) || "TOT";
      seen.set(key, { ...p, team: resolvedTeam });
    } else if (!seen.has(key)) {
      // Single-team player (no TOT row)
      seen.set(key, p);
    }
    // Skip individual team rows if we already have TOT
  }

  return Array.from(seen.values());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function batchInsert(supabase: any, rows: LeaderRow[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("stat_leaders").insert(batch as any);
    if (error) {
      console.error(`Batch insert error at ${i}:`, error);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
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

  const results: Record<string, number> = {};
  const now = new Date().toISOString();

  try {
    // ── Build player name → player_id lookup from rosters table ──
    const { data: rosterData } = await supabase
      .from("rosters")
      .select("player_id, first_name, last_name, team_tricode")
      .eq("season", SEASON);

    const nameToPlayerId = new Map<string, number>();
    if (rosterData) {
      for (const r of rosterData) {
        const key = `${r.first_name} ${r.last_name}`.toLowerCase();
        nameToPlayerId.set(key, r.player_id);
        // Also store with team for disambiguation
        nameToPlayerId.set(`${key}|${r.team_tricode}`, r.player_id);
      }
    }

    function resolvePlayerId(name: string, team: string): number {
      const lowerName = name.toLowerCase();
      // Try name+team first for disambiguation
      return nameToPlayerId.get(`${lowerName}|${team}`) ||
        nameToPlayerId.get(lowerName) || 0;
    }

    // ── Fetch Basketball Reference pages with delays ──
    console.log("[SYNC-STATS] Fetching per-game stats...");
    const perGameHtml = await fetchHtml(
      `https://www.basketball-reference.com/leagues/NBA_${BR_YEAR}_per_game.html`
    );
    await delay(3000);

    console.log("[SYNC-STATS] Fetching totals stats...");
    const totalsHtml = await fetchHtml(
      `https://www.basketball-reference.com/leagues/NBA_${BR_YEAR}_totals.html`
    );
    await delay(3000);

    console.log("[SYNC-STATS] Fetching advanced stats...");
    const advancedHtml = await fetchHtml(
      `https://www.basketball-reference.com/leagues/NBA_${BR_YEAR}_advanced.html`
    );

    // ── Parse tables ──
    const perGamePlayers = deduplicatePlayers(parseBRTable(perGameHtml));
    const totalsPlayers = deduplicatePlayers(parseBRTable(totalsHtml));
    const advancedPlayers = deduplicatePlayers(parseBRTable(advancedHtml));

    console.log(`[SYNC-STATS] Parsed: ${perGamePlayers.length} per-game, ${totalsPlayers.length} totals, ${advancedPlayers.length} advanced`);

    // Index totals and advanced by player name for cross-referencing
    const totalsByName = new Map<string, BRPlayer>();
    for (const p of totalsPlayers) totalsByName.set(p.name, p);

    const advByName = new Map<string, BRPlayer>();
    for (const p of advancedPlayers) advByName.set(p.name, p);

    // ── League averages for "+" stats (from totals) ──
    let leaguePTS = 0, leagueFGA = 0, leagueFGM = 0;
    let leagueFG3M = 0, leagueFG3A = 0;
    let leagueFTM = 0, leagueFTA = 0;
    for (const p of totalsPlayers) {
      leaguePTS += p.stats["pts"] || 0;
      leagueFGA += p.stats["fga"] || 0;
      leagueFGM += p.stats["fg"] || 0;
      leagueFG3M += p.stats["fg3"] || 0;
      leagueFG3A += p.stats["fg3a"] || 0;
      leagueFTM += p.stats["ft"] || 0;
      leagueFTA += p.stats["fta"] || 0;
    }

    const leagueTS = leagueFGA + 0.44 * leagueFTA > 0
      ? (leaguePTS / (2 * (leagueFGA + 0.44 * leagueFTA))) * 100 : 0;
    const leagueEFG = leagueFGA > 0
      ? ((leagueFGM + 0.5 * leagueFG3M) / leagueFGA) * 100 : 0;
    const leagueFG = leagueFGA > 0 ? (leagueFGM / leagueFGA) * 100 : 0;
    const leagueFG3 = leagueFG3A > 0 ? (leagueFG3M / leagueFG3A) * 100 : 0;
    const leagueFT = leagueFTA > 0 ? (leagueFTM / leagueFTA) * 100 : 0;
    const leagueFG2M = leagueFGM - leagueFG3M;
    const leagueFG2A = leagueFGA - leagueFG3A;
    const leagueFG2 = leagueFG2A > 0 ? (leagueFG2M / leagueFG2A) * 100 : 0;

    // ── Helper: build leaders with eligibility ──
    function buildLeadersWithEligibility(
      category: string,
      allPlayers: { name: string; team: string; playerId: number; val: number; eligible: boolean }[]
    ): LeaderRow[] {
      const eligible = allPlayers.filter((p) => p.eligible).sort((a, b) => b.val - a.val);
      const ineligible = allPlayers.filter((p) => !p.eligible).sort((a, b) => b.val - a.val);
      const eligibleCount = eligible.length;

      const leaders: LeaderRow[] = [];

      // Metadata row
      leaders.push({
        category,
        rank: 0,
        player_name: "__eligible_count__",
        player_id: 0,
        team: "",
        value: eligibleCount,
        season: SEASON,
        updated_at: now,
      });

      eligible.forEach(({ name, team, playerId, val }, i) => {
        leaders.push({
          category,
          rank: i + 1,
          player_name: name,
          player_id: playerId,
          team,
          value: Math.round(val * 100) / 100,
          season: SEASON,
          updated_at: now,
        });
      });

      ineligible.forEach(({ name, team, playerId, val }, i) => {
        leaders.push({
          category,
          rank: eligibleCount + i + 1,
          player_name: name,
          player_id: playerId,
          team,
          value: Math.round(val * 100) / 100,
          season: SEASON,
          updated_at: now,
        });
      });

      return leaders;
    }

    // ── Delete all existing stat_leaders for this season ──
    await supabase.from("stat_leaders").delete().eq("season", SEASON);

    // ── Per-game categories (from per-game page) ──
    // Maps our category names to BR data-stat field names
    const PER_GAME_CATEGORIES: { category: string; brField: string }[] = [
      { category: "PTS", brField: "pts_per_g" },
      { category: "REB", brField: "trb_per_g" },
      { category: "AST", brField: "ast_per_g" },
      { category: "BLK", brField: "blk_per_g" },
      { category: "STL", brField: "stl_per_g" },
      { category: "TOV", brField: "tov_per_g" },
      { category: "MIN", brField: "mp_per_g" },
      { category: "OREB", brField: "orb_per_g" },
      { category: "DREB", brField: "drb_per_g" },
    ];

    for (const { category, brField } of PER_GAME_CATEGORIES) {
      const allPlayers = perGamePlayers
        .filter((p) => p.stats[brField] !== undefined)
        .map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: p.stats[brField],
          eligible: (p.stats["g"] || 0) >= MIN_GP,
        }));
      const leaders = buildLeadersWithEligibility(category, allPlayers);
      results[category] = await batchInsert(supabase, leaders);
    }

    // ── EFF (simplified fantasy: PTS + REB + AST + STL + BLK - TOV) per game ──
    {
      const allPlayers = perGamePlayers.map((p) => {
        const val = (p.stats["pts_per_g"] || 0) +
          (p.stats["trb_per_g"] || 0) +
          (p.stats["ast_per_g"] || 0) +
          (p.stats["stl_per_g"] || 0) +
          (p.stats["blk_per_g"] || 0) -
          (p.stats["tov_per_g"] || 0);
        return {
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val,
          eligible: (p.stats["g"] || 0) >= MIN_GP,
        };
      });
      const leaders = buildLeadersWithEligibility("EFF", allPlayers);
      results["EFF"] = await batchInsert(supabase, leaders);
    }

    // ── GP (games played — raw count) ──
    {
      const allPlayers = perGamePlayers.map((p) => ({
        name: p.name,
        team: p.team,
        playerId: resolvePlayerId(p.name, p.team),
        val: p.stats["g"] || 0,
        eligible: (p.stats["g"] || 0) >= MIN_GP,
      }));
      results["GP"] = await batchInsert(supabase, buildLeadersWithEligibility("GP", allPlayers));
    }

    // ── TOT_MIN (total minutes from totals page) ──
    {
      const allPlayers = totalsPlayers.map((p) => ({
        name: p.name,
        team: p.team,
        playerId: resolvePlayerId(p.name, p.team),
        val: p.stats["mp"] || 0,
        eligible: (p.stats["g"] || 0) >= MIN_GP,
      }));
      results["TOT_MIN"] = await batchInsert(supabase, buildLeadersWithEligibility("TOT_MIN", allPlayers));
    }

    // ── Season totals (from totals page) ──
    const TOTAL_CATEGORIES: { category: string; brField: string }[] = [
      { category: "PTS_TOT", brField: "pts" },
      { category: "REB_TOT", brField: "trb" },
      { category: "AST_TOT", brField: "ast" },
      { category: "BLK_TOT", brField: "blk" },
      { category: "STL_TOT", brField: "stl" },
      { category: "TOV_TOT", brField: "tov" },
      { category: "FGM_TOT", brField: "fg" },
      { category: "FG3M_TOT", brField: "fg3" },
      { category: "FTM_TOT", brField: "ft" },
      { category: "OREB_TOT", brField: "orb" },
      { category: "DREB_TOT", brField: "drb" },
      { category: "PF_TOT", brField: "pf" },
      { category: "FGA_TOT", brField: "fga" },
      { category: "FG3A_TOT", brField: "fg3a" },
      { category: "FTA_TOT", brField: "fta" },
    ];

    for (const { category, brField } of TOTAL_CATEGORIES) {
      const allPlayers = totalsPlayers.map((p) => ({
        name: p.name,
        team: p.team,
        playerId: resolvePlayerId(p.name, p.team),
        val: p.stats[brField] || 0,
        eligible: (p.stats["g"] || 0) >= MIN_GP,
      }));
      results[category] = await batchInsert(supabase, buildLeadersWithEligibility(category, allPlayers));
    }

    // FG2A_TOT = FGA - FG3A
    {
      const allPlayers = totalsPlayers.map((p) => ({
        name: p.name,
        team: p.team,
        playerId: resolvePlayerId(p.name, p.team),
        val: (p.stats["fga"] || 0) - (p.stats["fg3a"] || 0),
        eligible: (p.stats["g"] || 0) >= MIN_GP,
      }));
      results["FG2A_TOT"] = await batchInsert(supabase, buildLeadersWithEligibility("FG2A_TOT", allPlayers));
    }

    // FG2M_TOT = FGM - FG3M
    {
      const allPlayers = totalsPlayers.map((p) => ({
        name: p.name,
        team: p.team,
        playerId: resolvePlayerId(p.name, p.team),
        val: (p.stats["fg"] || 0) - (p.stats["fg3"] || 0),
        eligible: (p.stats["g"] || 0) >= MIN_GP,
      }));
      results["FG2M_TOT"] = await batchInsert(supabase, buildLeadersWithEligibility("FG2M_TOT", allPlayers));
    }

    // PLUS_MINUS_TOT — check if available on totals page
    {
      const hasData = totalsPlayers.some((p) => p.stats["plus_minus"] !== undefined);
      if (hasData) {
        const allPlayers = totalsPlayers.map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: p.stats["plus_minus"] || 0,
          eligible: (p.stats["g"] || 0) >= MIN_GP,
        }));
        results["PLUS_MINUS_TOT"] = await batchInsert(supabase, buildLeadersWithEligibility("PLUS_MINUS_TOT", allPlayers));
      }
    }

    // ── Percentage categories (calculated from totals for precision) ──

    // Helper: per-game attempts from totals
    const fgaPerGame = (p: BRPlayer) => {
      const gp = p.stats["g"] || 0;
      return gp > 0 ? (p.stats["fga"] || 0) / gp : 0;
    };
    const fg3aPerGame = (p: BRPlayer) => {
      const gp = p.stats["g"] || 0;
      return gp > 0 ? (p.stats["fg3a"] || 0) / gp : 0;
    };
    const ftaPerGame = (p: BRPlayer) => {
      const gp = p.stats["g"] || 0;
      return gp > 0 ? (p.stats["fta"] || 0) / gp : 0;
    };

    // FG3_PCT
    {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fg3a"] || 0) > 0)
        .map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: ((p.stats["fg3"] || 0) / (p.stats["fg3a"] || 1)) * 100,
          eligible: (p.stats["g"] || 0) >= MIN_GP && fg3aPerGame(p) >= MIN_FG3A,
        }));
      results["FG3_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("FG3_PCT", allPlayers));
    }

    // FG2_PCT
    {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fga"] || 0) - (p.stats["fg3a"] || 0) > 0)
        .map((p) => {
          const fg2m = (p.stats["fg"] || 0) - (p.stats["fg3"] || 0);
          const fg2a = (p.stats["fga"] || 0) - (p.stats["fg3a"] || 0);
          const gp = p.stats["g"] || 0;
          const fg2aPerG = gp > 0 ? fg2a / gp : 0;
          return {
            name: p.name,
            team: p.team,
            playerId: resolvePlayerId(p.name, p.team),
            val: fg2a > 0 ? (fg2m / fg2a) * 100 : 0,
            eligible: (p.stats["g"] || 0) >= MIN_GP && fg2aPerG >= MIN_FG2A,
          };
        });
      results["FG2_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("FG2_PCT", allPlayers));
    }

    // TS_PCT
    {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fga"] || 0) > 0)
        .map((p) => {
          const pts = p.stats["pts"] || 0;
          const fga = p.stats["fga"] || 0;
          const fta = p.stats["fta"] || 0;
          return {
            name: p.name,
            team: p.team,
            playerId: resolvePlayerId(p.name, p.team),
            val: (pts / (2 * (fga + 0.44 * fta))) * 100,
            eligible: (p.stats["g"] || 0) >= MIN_GP && fgaPerGame(p) >= MIN_FGA,
          };
        });
      results["TS_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("TS_PCT", allPlayers));
    }

    // FG_PCT
    {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fga"] || 0) > 0)
        .map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: ((p.stats["fg"] || 0) / (p.stats["fga"] || 1)) * 100,
          eligible: (p.stats["g"] || 0) >= MIN_GP && fgaPerGame(p) >= MIN_FGA,
        }));
      results["FG_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("FG_PCT", allPlayers));
    }

    // FT_PCT
    {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fta"] || 0) > 0)
        .map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: ((p.stats["ft"] || 0) / (p.stats["fta"] || 1)) * 100,
          eligible: (p.stats["g"] || 0) >= MIN_GP && ftaPerGame(p) >= MIN_FTA,
        }));
      results["FT_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("FT_PCT", allPlayers));
    }

    // EFG_PCT
    {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fga"] || 0) > 0)
        .map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: (((p.stats["fg"] || 0) + 0.5 * (p.stats["fg3"] || 0)) / (p.stats["fga"] || 1)) * 100,
          eligible: (p.stats["g"] || 0) >= MIN_GP && fgaPerGame(p) >= MIN_FGA,
        }));
      results["EFG_PCT"] = await batchInsert(supabase, buildLeadersWithEligibility("EFG_PCT", allPlayers));
    }

    // ── Advanced categories (from advanced page) ──
    // BR stores percentages as decimals (0.285 = 28.5%), so multiply by 100
    const ADV_PCT_FIELDS = new Set([
      "usg_pct", "ast_pct", "orb_pct", "drb_pct", "trb_pct",
      "stl_pct", "blk_pct", "tov_pct",
    ]);

    const ADVANCED_CATEGORIES: { category: string; brField: string }[] = [
      { category: "USG_PCT", brField: "usg_pct" },
      { category: "OFF_RATING", brField: "off_rtg" },
      { category: "DEF_RATING", brField: "def_rtg" },
      { category: "AST_PCT", brField: "ast_pct" },
      { category: "OREB_PCT", brField: "orb_pct" },
      { category: "DREB_PCT", brField: "drb_pct" },
      { category: "REB_PCT", brField: "trb_pct" },
    ];

    for (const { category, brField } of ADVANCED_CATEGORIES) {
      const isPct = ADV_PCT_FIELDS.has(brField);
      const allPlayers = advancedPlayers
        .filter((p) => p.stats[brField] !== undefined)
        .map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: isPct ? p.stats[brField] * 100 : p.stats[brField],
          eligible: (p.stats["g"] || 0) >= MIN_GP,
        }));
      results[category] = await batchInsert(supabase, buildLeadersWithEligibility(category, allPlayers));
    }

    // NET_RATING = OFF_RATING - DEF_RATING
    {
      const allPlayers = advancedPlayers
        .filter((p) => p.stats["off_rtg"] !== undefined && p.stats["def_rtg"] !== undefined)
        .map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: p.stats["off_rtg"] - p.stats["def_rtg"],
          eligible: (p.stats["g"] || 0) >= MIN_GP,
        }));
      results["NET_RATING"] = await batchInsert(supabase, buildLeadersWithEligibility("NET_RATING", allPlayers));
    }

    // ── Adjusted "+" stats (player / league average * 100) ──

    // TS+
    if (leagueTS > 0) {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fga"] || 0) > 0)
        .map((p) => {
          const pts = p.stats["pts"] || 0;
          const fga = p.stats["fga"] || 0;
          const fta = p.stats["fta"] || 0;
          const playerTS = (pts / (2 * (fga + 0.44 * fta))) * 100;
          return {
            name: p.name,
            team: p.team,
            playerId: resolvePlayerId(p.name, p.team),
            val: (playerTS / leagueTS) * 100,
            eligible: (p.stats["g"] || 0) >= MIN_GP && fgaPerGame(p) >= MIN_FGA,
          };
        });
      results["TS_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("TS_PLUS", allPlayers));
    }

    // eFG+
    if (leagueEFG > 0) {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fga"] || 0) > 0)
        .map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: ((((p.stats["fg"] || 0) + 0.5 * (p.stats["fg3"] || 0)) / (p.stats["fga"] || 1)) * 100 / leagueEFG) * 100,
          eligible: (p.stats["g"] || 0) >= MIN_GP && fgaPerGame(p) >= MIN_FGA,
        }));
      results["EFG_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("EFG_PLUS", allPlayers));
    }

    // FG+
    if (leagueFG > 0) {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fga"] || 0) > 0)
        .map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: (((p.stats["fg"] || 0) / (p.stats["fga"] || 1)) * 100 / leagueFG) * 100,
          eligible: (p.stats["g"] || 0) >= MIN_GP && fgaPerGame(p) >= MIN_FGA,
        }));
      results["FG_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("FG_PLUS", allPlayers));
    }

    // 3P+
    if (leagueFG3 > 0) {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fg3a"] || 0) > 0)
        .map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: (((p.stats["fg3"] || 0) / (p.stats["fg3a"] || 1)) * 100 / leagueFG3) * 100,
          eligible: (p.stats["g"] || 0) >= MIN_GP && fg3aPerGame(p) >= MIN_FG3A,
        }));
      results["FG3_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("FG3_PLUS", allPlayers));
    }

    // FT+
    if (leagueFT > 0) {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fta"] || 0) > 0)
        .map((p) => ({
          name: p.name,
          team: p.team,
          playerId: resolvePlayerId(p.name, p.team),
          val: (((p.stats["ft"] || 0) / (p.stats["fta"] || 1)) * 100 / leagueFT) * 100,
          eligible: (p.stats["g"] || 0) >= MIN_GP && ftaPerGame(p) >= MIN_FTA,
        }));
      results["FT_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("FT_PLUS", allPlayers));
    }

    // 2P+
    if (leagueFG2 > 0) {
      const allPlayers = totalsPlayers
        .filter((p) => (p.stats["fga"] || 0) - (p.stats["fg3a"] || 0) > 0)
        .map((p) => {
          const fg2m = (p.stats["fg"] || 0) - (p.stats["fg3"] || 0);
          const fg2a = (p.stats["fga"] || 0) - (p.stats["fg3a"] || 0);
          const gp = p.stats["g"] || 0;
          const fg2aPerG = gp > 0 ? fg2a / gp : 0;
          return {
            name: p.name,
            team: p.team,
            playerId: resolvePlayerId(p.name, p.team),
            val: fg2a > 0 ? ((fg2m / fg2a) * 100 / leagueFG2) * 100 : 0,
            eligible: (p.stats["g"] || 0) >= MIN_GP && fg2aPerG >= MIN_FG2A,
          };
        });
      results["FG2_PLUS"] = await batchInsert(supabase, buildLeadersWithEligibility("FG2_PLUS", allPlayers));
    }
  } catch (err) {
    console.error("Error syncing stats:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }

  revalidatePath("/statistiques");
  console.log(`[SYNC-STATS] Completed at ${new Date().toISOString()}`);

  return NextResponse.json({
    ok: true,
    synced: results,
    timestamp: new Date().toISOString(),
  });
}
