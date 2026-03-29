import https from "node:https";
import { createClient } from "@supabase/supabase-js";

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
  resultSets: { name?: string; headers: string[]; rowSet: (string | number | null)[][] }[];
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
    // No timeout — local sync can take as long as needed
  });
}

export interface CareerSeason {
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
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  tov: number;
  pf: number;
  plus_minus: number;
  off_rating: number;
  def_rating: number;
  net_rating: number;
  ts_pct: number;
  efg_pct: number;
  usg_pct: number;
  pace: number;
  pie: number;
  ast_pct: number;
  oreb_pct: number;
  dreb_pct: number;
  reb_pct: number;
  ts_plus: number;
  efg_plus: number;
  fg_plus: number;
  fg3_plus: number;
  ft_plus: number;
  fg2_plus: number;
}

/* ─── League averages for Adjusted Shooting calculation ─── */
/* Source: Basketball Reference historical league averages (public data).
   Formula: stat+ = 100 * (player_stat / league_stat).
   100 = league average, >100 = above average, <100 = below average. */

interface LeagueAvg { fg: number; fg2: number; fg3: number; efg: number; ft: number; ts: number }

const LEAGUE_AVG: Record<string, LeagueAvg> = {
  "1996-97": { fg: .455, fg2: .491, fg3: .360, efg: .474, ft: .749, ts: .535 },
  "1997-98": { fg: .450, fg2: .488, fg3: .346, efg: .470, ft: .753, ts: .530 },
  "1998-99": { fg: .437, fg2: .472, fg3: .339, efg: .456, ft: .742, ts: .517 },
  "1999-00": { fg: .449, fg2: .489, fg3: .353, efg: .473, ft: .750, ts: .534 },
  "2000-01": { fg: .443, fg2: .483, fg3: .354, efg: .470, ft: .750, ts: .530 },
  "2001-02": { fg: .443, fg2: .482, fg3: .354, efg: .471, ft: .755, ts: .529 },
  "2002-03": { fg: .442, fg2: .477, fg3: .349, efg: .468, ft: .755, ts: .523 },
  "2003-04": { fg: .439, fg2: .472, fg3: .347, efg: .464, ft: .749, ts: .519 },
  "2004-05": { fg: .447, fg2: .480, fg3: .357, efg: .474, ft: .753, ts: .531 },
  "2005-06": { fg: .454, fg2: .488, fg3: .358, efg: .481, ft: .754, ts: .537 },
  "2006-07": { fg: .457, fg2: .490, fg3: .358, efg: .483, ft: .755, ts: .541 },
  "2007-08": { fg: .457, fg2: .490, fg3: .362, efg: .484, ft: .756, ts: .540 },
  "2008-09": { fg: .459, fg2: .493, fg3: .367, efg: .488, ft: .770, ts: .545 },
  "2009-10": { fg: .461, fg2: .496, fg3: .355, efg: .486, ft: .760, ts: .543 },
  "2010-11": { fg: .459, fg2: .493, fg3: .358, efg: .485, ft: .756, ts: .542 },
  "2011-12": { fg: .448, fg2: .480, fg3: .349, efg: .473, ft: .752, ts: .531 },
  "2012-13": { fg: .452, fg2: .480, fg3: .359, efg: .480, ft: .753, ts: .535 },
  "2013-14": { fg: .452, fg2: .479, fg3: .360, efg: .480, ft: .756, ts: .540 },
  "2014-15": { fg: .449, fg2: .477, fg3: .350, efg: .476, ft: .750, ts: .534 },
  "2015-16": { fg: .452, fg2: .479, fg3: .354, efg: .480, ft: .757, ts: .541 },
  "2016-17": { fg: .457, fg2: .485, fg3: .358, efg: .487, ft: .772, ts: .552 },
  "2017-18": { fg: .460, fg2: .484, fg3: .362, efg: .491, ft: .766, ts: .556 },
  "2018-19": { fg: .461, fg2: .481, fg3: .355, efg: .491, ft: .766, ts: .559 },
  "2019-20": { fg: .460, fg2: .482, fg3: .358, efg: .492, ft: .765, ts: .560 },
  "2020-21": { fg: .466, fg2: .485, fg3: .367, efg: .499, ft: .778, ts: .572 },
  "2021-22": { fg: .461, fg2: .482, fg3: .354, efg: .492, ft: .776, ts: .561 },
  "2022-23": { fg: .473, fg2: .495, fg3: .360, efg: .506, ft: .782, ts: .577 },
  "2023-24": { fg: .473, fg2: .498, fg3: .366, efg: .509, ft: .783, ts: .580 },
  "2024-25": { fg: .470, fg2: .492, fg3: .363, efg: .505, ft: .780, ts: .575 },
  "2025-26": { fg: .472, fg2: .495, fg3: .365, efg: .507, ft: .781, ts: .578 },
};

/** Compute Adjusted Shooting (+ stats) from raw player stats and league averages. */
function computeAdjustedShooting(row: {
  season: string;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  pts: number;
}): { ts_plus: number; efg_plus: number; fg_plus: number; fg3_plus: number; ft_plus: number; fg2_plus: number } {
  const avg = LEAGUE_AVG[row.season];
  if (!avg || row.fga === 0) {
    return { ts_plus: 0, efg_plus: 0, fg_plus: 0, fg3_plus: 0, ft_plus: 0, fg2_plus: 0 };
  }

  const playerTs = row.fga + 0.44 * row.fta > 0
    ? row.pts / (2 * (row.fga + 0.44 * row.fta))
    : 0;
  const playerEfg = row.fga > 0
    ? (row.fgm + 0.5 * row.fg3m) / row.fga
    : 0;
  const fg2a = row.fga - row.fg3a;
  const fg2m = row.fgm - row.fg3m;
  const playerFg2 = fg2a > 0 ? fg2m / fg2a : 0;

  const safe = (player: number, league: number) =>
    league > 0 ? Math.round(100 * player / league) : 0;

  return {
    ts_plus: safe(playerTs, avg.ts),
    efg_plus: safe(playerEfg, avg.efg),
    fg_plus: safe(row.fg_pct, avg.fg),
    fg3_plus: safe(row.fg3_pct, avg.fg3),
    ft_plus: safe(row.ft_pct, avg.ft),
    fg2_plus: safe(playerFg2, avg.fg2),
  };
}

/**
 * Fetch advanced stats (OFF_RATING, DEF_RATING, TS%, eFG%, USG%, etc.)
 * per season via playerdashboardbyyearoveryear with MeasureType=Advanced.
 */
async function fetchAdvancedByYear(playerId: number): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  try {
    const data = await fetchNba(
      `https://stats.nba.com/stats/playerdashboardbyyearoveryear?DateFrom=&DateTo=&GameSegment=&LastNGames=0&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerID=${playerId}&PlusMinus=N&Rank=N&Season=2024-25&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&VsConference=&VsDivision=`
    );
    const rs = data.resultSets.find((r) => r.name === "ByYearPlayerDashboard");
    if (!rs) return map;

    const h = rs.headers;
    const ii = (name: string) => h.indexOf(name);

    for (const row of rs.rowSet) {
      const seasonRaw = String(row[ii("GROUP_VALUE")] || "");
      // Convert "2024-25" format — GROUP_VALUE is like "2024-25"
      const key = seasonRaw;
      map.set(key, {
        off_rating: Number(row[ii("OFF_RATING")] || 0),
        def_rating: Number(row[ii("DEF_RATING")] || 0),
        net_rating: Number(row[ii("NET_RATING")] || 0),
        ts_pct: Number(row[ii("TS_PCT")] || 0),
        efg_pct: Number(row[ii("EFG_PCT")] || 0),
        usg_pct: Number(row[ii("USG_PCT")] || 0),
        pace: Number(row[ii("PACE")] || 0),
        pie: Number(row[ii("PIE")] || 0),
        ast_pct: Number(row[ii("AST_PCT")] || 0),
        oreb_pct: Number(row[ii("OREB_PCT")] || 0),
        dreb_pct: Number(row[ii("DREB_PCT")] || 0),
        reb_pct: Number(row[ii("REB_PCT")] || 0),
      });
    }
  } catch {
    // Advanced stats are optional — fail silently
  }
  return map;
}

export async function syncPlayerCareer(
  playerId: number,
): Promise<CareerSeason[]> {
  try {
    // Fetch base career stats and advanced stats in parallel
    const [baseData, advancedMap] = await Promise.all([
      fetchNba(
        `https://stats.nba.com/stats/playercareerstats?LeagueID=00&PerMode=PerGame&PlayerID=${playerId}`
      ),
      fetchAdvancedByYear(playerId),
    ]);

    const rs = baseData.resultSets.find((r) => r.headers.includes("SEASON_ID"));
    if (!rs || rs.rowSet.length === 0) return [];

    const h = rs.headers;
    const ii = (name: string) => h.indexOf(name);
    const now = new Date().toISOString();

    const rows = rs.rowSet.map((row) => {
      const season = String(row[ii("SEASON_ID")] || "");
      const adv = advancedMap.get(season) || {};

      const fgm = Number(row[ii("FGM")] || 0);
      const fga = Number(row[ii("FGA")] || 0);
      const fg3m = Number(row[ii("FG3M")] || 0);
      const fg3a = Number(row[ii("FG3A")] || 0);
      const ftm = Number(row[ii("FTM")] || 0);
      const fta = Number(row[ii("FTA")] || 0);
      const pts = Number(row[ii("PTS")] || 0);
      const fg_pct = Number(row[ii("FG_PCT")] || 0);
      const fg3_pct = Number(row[ii("FG3_PCT")] || 0);
      const ft_pct = Number(row[ii("FT_PCT")] || 0);

      const adj = computeAdjustedShooting({
        season, fg_pct, fg3_pct, ft_pct, fgm, fga, fg3m, fg3a, ftm, fta, pts,
      });

      return {
        player_id: playerId,
        season,
        team: String(row[ii("TEAM_ABBREVIATION")] || ""),
        gp: Number(row[ii("GP")] || 0),
        min: Number(row[ii("MIN")] || 0),
        pts,
        reb: Number(row[ii("REB")] || 0),
        ast: Number(row[ii("AST")] || 0),
        stl: Number(row[ii("STL")] || 0),
        blk: Number(row[ii("BLK")] || 0),
        fg_pct,
        fg3_pct,
        ft_pct,
        fgm,
        fga,
        fg3m,
        fg3a,
        ftm,
        fta,
        oreb: Number(row[ii("OREB")] || 0),
        dreb: Number(row[ii("DREB")] || 0),
        tov: Number(row[ii("TOV")] || 0),
        pf: Number(row[ii("PF")] || 0),
        plus_minus: Number(row[ii("PLUS_MINUS")] || 0),
        off_rating: adv.off_rating ?? 0,
        def_rating: adv.def_rating ?? 0,
        net_rating: adv.net_rating ?? 0,
        ts_pct: adv.ts_pct ?? 0,
        efg_pct: adv.efg_pct ?? 0,
        usg_pct: adv.usg_pct ?? 0,
        pace: adv.pace ?? 0,
        pie: adv.pie ?? 0,
        ast_pct: adv.ast_pct ?? 0,
        oreb_pct: adv.oreb_pct ?? 0,
        dreb_pct: adv.dreb_pct ?? 0,
        reb_pct: adv.reb_pct ?? 0,
        ts_plus: adj.ts_plus,
        efg_plus: adj.efg_plus,
        fg_plus: adj.fg_plus,
        fg3_plus: adj.fg3_plus,
        ft_plus: adj.ft_plus,
        fg2_plus: adj.fg2_plus,
        updated_at: now,
      };
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabase.from("player_career_stats").upsert(rows, { onConflict: "player_id,season,team" });

    return rows;
  } catch {
    return [];
  }
}
