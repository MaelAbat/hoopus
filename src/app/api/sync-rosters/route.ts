import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";
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
  resultSets: {
    headers: string[];
    rowSet: (string | number | null)[][];
  }[];
}

/* ─── Salary scraping from Basketball Reference ─── */
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
          // Handle relative redirects
          if (location.startsWith("/")) {
            const parsed = new URL(url);
            location = `${parsed.protocol}//${parsed.host}${location}`;
          }
          res.resume(); // drain the response
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
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error("HTML fetch timeout"));
      });
    } catch (err) {
      reject(err);
    }
  });
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Basketball Reference tricode mapping (some differ from NBA)
const BR_TRICODE_MAP: Record<string, string> = {
  PHO: "PHX",
  BRK: "BKN",
  CHO: "CHA",
};

// All 30 BR team slugs
const BR_TEAMS = [
  "ATL", "BOS", "BRK", "CHI", "CHO", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHO", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
];

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchTeamSalaries(brTeam: string, salaryMap: Map<string, string>) {
  const html = await fetchHtml(`https://www.basketball-reference.com/contracts/${brTeam}.html`);
  const nbaTeam = BR_TRICODE_MAP[brTeam] || brTeam;
  const rows = html.match(/<tr\s*>[\s\S]*?<\/tr>/g) || [];

  for (const row of rows) {
    const playerMatch = row.match(/data-stat="player"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/);
    if (!playerMatch) continue;
    const salaryMatch = row.match(/data-stat="y1"[^>]*>(\$[\d,]+)/);
    if (!salaryMatch) continue;

    const key = normalizeName(playerMatch[1].trim()) + "|" + nbaTeam;
    salaryMap.set(key, salaryMatch[1]);
  }
}

async function fetchTeamPayrolls(): Promise<Map<string, number>> {
  const payrollMap = new Map<string, number>();
  try {
    const html = await fetchHtml("https://www.basketball-reference.com/contracts/");
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
    for (const row of rows) {
      const tricodeMatch = row.match(/\/contracts\/([A-Z]{3})\.html/);
      if (!tricodeMatch) continue;
      const payrollMatch = row.match(/data-stat="y1"[^>]*>(\$[\d,]+)/);
      if (!payrollMatch) continue;
      let tri = tricodeMatch[1];
      tri = BR_TRICODE_MAP[tri] || tri;
      const amount = Number(payrollMatch[1].replace(/[$,]/g, "")) || 0;
      payrollMap.set(tri, amount);
    }
    console.log(`Payroll scraping: found ${payrollMap.size} team totals`);
  } catch (err) {
    console.error("Error scraping payrolls:", err);
  }
  return payrollMap;
}

async function fetchSalaries(): Promise<Map<string, string>> {
  const salaryMap = new Map<string, string>();

  try {
    // Fetch team pages in batches of 5 to avoid rate limiting
    for (let i = 0; i < BR_TEAMS.length; i += 5) {
      const batch = BR_TEAMS.slice(i, i + 5);
      await Promise.all(batch.map(team => fetchTeamSalaries(team, salaryMap).catch(err => {
        console.error(`Salary scrape failed for ${team}:`, err.message);
      })));
      // Small delay between batches to be polite
      if (i + 5 < BR_TEAMS.length) await delay(1000);
    }
    console.log(`Salary scraping: found ${salaryMap.size} salaries from ${BR_TEAMS.length} team pages`);
  } catch (err) {
    console.error("Error scraping salaries:", err);
  }

  return salaryMap;
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
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Failed to parse NBA API response"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(300000, () => {
      req.destroy();
      reject(new Error("NBA API timeout"));
    });
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

  try {
    // Fetch player index and bio stats (critical), salary is best-effort
    const [indexData, bioData] = await Promise.all([
      fetchNba(
        "https://stats.nba.com/stats/playerindex?" +
          "College=&Conference=&Country=&DraftPick=&DraftRound=&DraftYear=" +
          "&Height=&Historical=0&LeagueID=00&Season=" + SEASON +
          "&SeasonType=Regular+Season&TeamID=0&Weight="
      ),
      fetchNba(
        "https://stats.nba.com/stats/leaguedashplayerbiostats?" +
          "College=&Conference=&Country=&DateFrom=&DateTo=&Division=" +
          "&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=" +
          "&ISTRound=&LastNGames=0&LeagueID=00&Location=&Month=0" +
          "&OpponentTeamID=0&Outcome=&PORound=0&PerMode=PerGame" +
          "&Period=0&PlayerExperience=&PlayerPosition=&Season=" + SEASON +
          "&SeasonSegment=&SeasonType=Regular+Season" +
          "&ShotClockRange=&StarterBench=&TeamID=0" +
          "&VsConference=&VsDivision=&Weight="
      ),
    ]);

    // Salary + payroll scraping is best-effort — never blocks the sync
    let salaryMap = new Map<string, string>();
    let payrollMap = new Map<string, number>();
    try {
      [salaryMap, payrollMap] = await Promise.all([
        fetchSalaries(),
        fetchTeamPayrolls(),
      ]);
    } catch (err) {
      console.error("Salary/payroll scraping failed (non-fatal):", err);
    }

    // Parse player index
    const idxHeaders = indexData.resultSets[0].headers;
    const idxRows = indexData.resultSets[0].rowSet;
    const ii = (name: string) => idxHeaders.indexOf(name);

    // Parse bio stats (for age)
    const bioHeaders = bioData.resultSets[0].headers;
    const bioRows = bioData.resultSets[0].rowSet;
    const bi = (name: string) => bioHeaders.indexOf(name);

    // Build age lookup: player_id → age
    const ageMap = new Map<number, number>();
    for (const row of bioRows) {
      const playerId = Number(row[bi("PLAYER_ID")]);
      const age = row[bi("AGE")] != null ? Number(row[bi("AGE")]) : null;
      if (playerId && age) ageMap.set(playerId, age);
    }

    const now = new Date().toISOString();
    const players = [];

    for (const row of idxRows) {
      const rosterStatus = row[ii("ROSTER_STATUS")];
      // Only include players currently on a roster
      if (rosterStatus !== 1 && rosterStatus !== "1") continue;

      const playerId = Number(row[ii("PERSON_ID")]);
      const teamTricode = String(row[ii("TEAM_ABBREVIATION")] || "");
      if (!teamTricode) continue;

      const firstName = String(row[ii("PLAYER_FIRST_NAME")] || "");
      const lastName = String(row[ii("PLAYER_LAST_NAME")] || "");

      // Match salary by normalized name + team
      const salaryKey = normalizeName(`${firstName} ${lastName}`) + "|" + teamTricode;
      const salary = salaryMap.get(salaryKey) || null;

      players.push({
        season: SEASON,
        player_id: playerId,
        first_name: firstName,
        last_name: lastName,
        team_tricode: teamTricode,
        team_name: String(row[ii("TEAM_NAME")] || ""),
        team_city: String(row[ii("TEAM_CITY")] || ""),
        jersey_number: String(row[ii("JERSEY_NUMBER")] ?? ""),
        position: String(row[ii("POSITION")] || ""),
        height: String(row[ii("HEIGHT")] || ""),
        weight: String(row[ii("WEIGHT")] || ""),
        age: ageMap.get(playerId) || null,
        college: String(row[ii("COLLEGE")] || ""),
        country: String(row[ii("COUNTRY")] || ""),
        draft_year: row[ii("DRAFT_YEAR")] ? Number(row[ii("DRAFT_YEAR")]) : null,
        draft_round: row[ii("DRAFT_ROUND")] ? Number(row[ii("DRAFT_ROUND")]) : null,
        draft_number: row[ii("DRAFT_NUMBER")] ? Number(row[ii("DRAFT_NUMBER")]) : null,
        pts: row[ii("PTS")] != null ? Number(row[ii("PTS")]) : null,
        reb: row[ii("REB")] != null ? Number(row[ii("REB")]) : null,
        ast: row[ii("AST")] != null ? Number(row[ii("AST")]) : null,
        salary,
        updated_at: now,
      });
    }

    // Clear and reinsert
    await supabase.from("rosters").delete().eq("season", SEASON);

    let inserted = 0;
    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      const batch = players.slice(i, i + BATCH_SIZE);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("rosters").insert(batch as any);
      if (error) {
        console.error(`Batch insert error at ${i}:`, error);
      } else {
        inserted += batch.length;
      }
    }

    // Store team payroll totals
    if (payrollMap.size > 0) {
      await supabase.from("team_payrolls").delete().eq("season", SEASON);
      const payrollRows = Array.from(payrollMap.entries()).map(([tricode, payroll]) => ({
        season: SEASON,
        team_tricode: tricode,
        payroll,
        updated_at: now,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: payrollError } = await supabase.from("team_payrolls").insert(payrollRows as any);
      if (payrollError) console.error("Payroll insert error:", payrollError);
    }

    revalidatePath("/equipes");
    console.log(`[SYNC-ROSTERS] Completed at ${now}`);

    return NextResponse.json({
      ok: true,
      players: inserted,
      payrolls: payrollMap.size,
      timestamp: now,
    });
  } catch (err) {
    console.error("Error syncing rosters:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
