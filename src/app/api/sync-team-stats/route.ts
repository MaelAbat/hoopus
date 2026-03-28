import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";
const SEASON_END_YEAR = "2026";

const TEAM_NAME_TO_TRICODE: Record<string, string> = {
  "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
  "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL", "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA", "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP", "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR", "Utah Jazz": "UTA", "Washington Wizards": "WAS",
};

const TRICODE_TO_ID: Record<string, number> = {
  "ATL": 1610612737, "BOS": 1610612738, "BKN": 1610612751, "CHA": 1610612766,
  "CHI": 1610612741, "CLE": 1610612739, "DAL": 1610612742, "DEN": 1610612743,
  "DET": 1610612765, "GSW": 1610612744, "HOU": 1610612745, "IND": 1610612754,
  "LAC": 1610612746, "LAL": 1610612747, "MEM": 1610612763, "MIA": 1610612748,
  "MIL": 1610612749, "MIN": 1610612750, "NOP": 1610612740, "NYK": 1610612752,
  "OKC": 1610612760, "ORL": 1610612753, "PHI": 1610612755, "PHX": 1610612756,
  "POR": 1610612757, "SAC": 1610612758, "SAS": 1610612759, "TOR": 1610612761,
  "UTA": 1610612762, "WAS": 1610612764,
};

/* ─── HTML fetching with redirect handling ─── */
function fetchHtml(url: string, redirects = 0): Promise<string> {
  if (redirects > 5) return Promise.reject(new Error("Too many redirects"));
  return new Promise((resolve, reject) => {
    try {
      const req = https.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
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
            reject(new Error(`HTML fetch error: ${res.statusCode}`));
            return;
          }
          resolve(data);
        });
      });
      req.on("error", reject);
      req.setTimeout(120000, () => {
        req.destroy();
        reject(new Error("HTML fetch timeout"));
      });
    } catch (err) {
      reject(err);
    }
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ─── Parse a data-stat value from a <td> or <th> tag ─── */
function extractStat(row: string, stat: string): string {
  // Match <td ... data-stat="stat" ...>VALUE</td> or <th ... data-stat="stat" ...>VALUE</th>
  const regex = new RegExp(
    `<(?:td|th)[^>]*data-stat="${stat}"[^>]*>(.*?)</(?:td|th)>`,
    "s"
  );
  const match = row.match(regex);
  if (!match) return "";
  // Strip inner HTML tags (e.g. <a href="...">Team Name</a> -> Team Name)
  return match[1].replace(/<[^>]+>/g, "").trim();
}

function parseFloat0(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

interface PerGameRow {
  teamName: string;
  gp: number;
  w: number;
  l: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
  oreb: number;
  dreb: number;
}

interface RatingsRow {
  teamName: string;
  off_rtg: number;
  def_rtg: number;
  net_rtg: number;
  pace: number;
}

/* ─── Parse per-game team stats table ─── */
function parsePerGameStats(html: string): PerGameRow[] {
  const results: PerGameRow[] = [];

  // Basketball Reference wraps some tables in comments. Unwrap them.
  const uncommented = html.replace(/<!--\s*/g, "").replace(/\s*-->/g, "");

  // Find the per_game-team table
  const tableRegex = /id="per_game-team"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/;
  const tableMatch = uncommented.match(tableRegex);
  if (!tableMatch) {
    console.error("[SYNC-TEAM-STATS] Could not find per_game-team table");
    return results;
  }

  const tbody = tableMatch[1];
  // Match each team row (full_table class)
  const rowRegex = /<tr[^>]*class="[^"]*full_table[^"]*"[^>]*>[\s\S]*?<\/tr>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const row = rowMatch[0];
    const teamName = extractStat(row, "team_name");
    if (!teamName || !TEAM_NAME_TO_TRICODE[teamName]) continue;

    results.push({
      teamName,
      gp: parseFloat0(extractStat(row, "g")),
      w: parseFloat0(extractStat(row, "wins")),
      l: parseFloat0(extractStat(row, "losses")),
      pts: parseFloat0(extractStat(row, "pts_per_g")),
      reb: parseFloat0(extractStat(row, "trb_per_g")),
      ast: parseFloat0(extractStat(row, "ast_per_g")),
      stl: parseFloat0(extractStat(row, "stl_per_g")),
      blk: parseFloat0(extractStat(row, "blk_per_g")),
      tov: parseFloat0(extractStat(row, "tov_per_g")),
      fg_pct: parseFloat0(extractStat(row, "fg_pct")),
      fg3_pct: parseFloat0(extractStat(row, "fg3_pct")),
      ft_pct: parseFloat0(extractStat(row, "ft_pct")),
      oreb: parseFloat0(extractStat(row, "orb_per_g")),
      dreb: parseFloat0(extractStat(row, "drb_per_g")),
    });
  }

  return results;
}

/* ─── Parse team shooting stats for TS% and eFG% ─── */
function parseShootingStats(html: string): Map<string, { ts_pct: number; efg_pct: number }> {
  const results = new Map<string, { ts_pct: number; efg_pct: number }>();

  const uncommented = html.replace(/<!--\s*/g, "").replace(/\s*-->/g, "");

  // Look for the shooting table (id="shooting-team")
  const tableRegex = /id="shooting-team"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/;
  const tableMatch = uncommented.match(tableRegex);
  if (!tableMatch) {
    return results;
  }

  const tbody = tableMatch[1];
  const rowRegex = /<tr[^>]*class="[^"]*full_table[^"]*"[^>]*>[\s\S]*?<\/tr>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const row = rowMatch[0];
    const teamName = extractStat(row, "team_name");
    if (!teamName) continue;

    results.set(teamName, {
      ts_pct: parseFloat0(extractStat(row, "ts_pct")),
      efg_pct: parseFloat0(extractStat(row, "efg_pct")),
    });
  }

  return results;
}

/* ─── Parse ratings page for ORtg, DRtg, NRtg, Pace ─── */
function parseRatings(html: string): RatingsRow[] {
  const results: RatingsRow[] = [];

  const uncommented = html.replace(/<!--\s*/g, "").replace(/\s*-->/g, "");

  // The ratings page has a table with id="ratings"
  const tableRegex = /id="ratings"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/;
  const tableMatch = uncommented.match(tableRegex);
  if (!tableMatch) {
    console.error("[SYNC-TEAM-STATS] Could not find ratings table");
    return results;
  }

  const tbody = tableMatch[1];
  const rowRegex = /<tr[^>]*class="[^"]*full_table[^"]*"[^>]*>[\s\S]*?<\/tr>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const row = rowMatch[0];
    const teamName = extractStat(row, "team_name");
    if (!teamName || !TEAM_NAME_TO_TRICODE[teamName]) continue;

    results.push({
      teamName,
      off_rtg: parseFloat0(extractStat(row, "off_rtg")),
      def_rtg: parseFloat0(extractStat(row, "def_rtg")),
      net_rtg: parseFloat0(extractStat(row, "net_rtg")),
      pace: parseFloat0(extractStat(row, "pace")),
    });
  }

  return results;
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

  const now = new Date().toISOString();

  try {
    // Fetch the main season page (per-game stats + shooting stats)
    const mainUrl = `https://www.basketball-reference.com/leagues/NBA_${SEASON_END_YEAR}.html`;
    console.log(`[SYNC-TEAM-STATS] Fetching ${mainUrl}`);
    const mainHtml = await fetchHtml(mainUrl);

    // Delay before next request
    await delay(3000);

    // Fetch the ratings page (ORtg, DRtg, NRtg, Pace)
    const ratingsUrl = `https://www.basketball-reference.com/leagues/NBA_${SEASON_END_YEAR}_ratings.html`;
    console.log(`[SYNC-TEAM-STATS] Fetching ${ratingsUrl}`);
    const ratingsHtml = await fetchHtml(ratingsUrl);

    // Parse per-game stats
    const perGameRows = parsePerGameStats(mainHtml);
    console.log(`[SYNC-TEAM-STATS] Parsed ${perGameRows.length} teams from per-game table`);

    // Parse shooting stats (TS%, eFG%)
    const shootingMap = parseShootingStats(mainHtml);

    // Parse ratings
    const ratingsRows = parseRatings(ratingsHtml);
    console.log(`[SYNC-TEAM-STATS] Parsed ${ratingsRows.length} teams from ratings table`);

    // Index ratings by team name
    const ratingsByTeam = new Map<string, RatingsRow>();
    for (const r of ratingsRows) {
      ratingsByTeam.set(r.teamName, r);
    }

    // Build team stats rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamStats: any[] = perGameRows.map((pg) => {
      const tricode = TEAM_NAME_TO_TRICODE[pg.teamName] || "";
      const teamId = TRICODE_TO_ID[tricode] || 0;
      const ratings = ratingsByTeam.get(pg.teamName);
      const shooting = shootingMap.get(pg.teamName);
      const wPct = pg.w + pg.l > 0 ? pg.w / (pg.w + pg.l) : 0;

      return {
        team_id: teamId,
        team_name: pg.teamName,
        team_tricode: tricode,
        season: SEASON,
        gp: pg.gp,
        w: pg.w,
        l: pg.l,
        w_pct: Math.round(wPct * 1000) / 1000,
        pts: pg.pts,
        reb: pg.reb,
        ast: pg.ast,
        stl: pg.stl,
        blk: pg.blk,
        tov: pg.tov,
        fg_pct: pg.fg_pct,
        fg3_pct: pg.fg3_pct,
        ft_pct: pg.ft_pct,
        oreb: pg.oreb,
        dreb: pg.dreb,
        plus_minus: 0,
        off_rating: ratings ? ratings.off_rtg : 0,
        def_rating: ratings ? ratings.def_rtg : 0,
        net_rating: ratings ? ratings.net_rtg : 0,
        pace: ratings ? ratings.pace : 0,
        ts_pct: shooting ? shooting.ts_pct : 0,
        efg_pct: shooting ? shooting.efg_pct : 0,
        ast_pct: 0,
        ast_ratio: 0,
        oreb_pct: 0,
        dreb_pct: 0,
        tm_tov_pct: 0,
        pie: 0,
        updated_at: now,
      };
    });

    // Delete and reinsert
    await supabase.from("team_stats").delete().eq("season", SEASON);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("team_stats").insert(teamStats as any);

    if (error) {
      console.error("Error inserting team stats:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/statistiques");
    revalidatePath("/equipes");
    console.log(`[SYNC-TEAM-STATS] Completed at ${now}`);

    return NextResponse.json({
      ok: true,
      teams: teamStats.length,
      timestamp: now,
    });

  } catch (err) {
    console.error("Error syncing team stats:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
