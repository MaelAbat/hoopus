import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSeason } from "@/lib/season";
import { isCronAuthorized } from "@/lib/cron-auth";

const SEASON = getCurrentSeason();
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
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTML fetch error: ${res.statusCode}`));
            return;
          }
          resolve(Buffer.concat(chunks).toString("utf-8"));
        });
      });
      req.on("error", reject);
      req.setTimeout(600000, () => { req.destroy(); reject(new Error("timeout after 10min")); });
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

function fetchNba(url: string, timeoutMs = 300000): Promise<NbaResponse> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: NBA_HEADERS }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`NBA API error: ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
        } catch {
          reject(new Error("Failed to parse NBA API response"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(600000, () => { req.destroy(); reject(new Error("timeout after 10min")); });
  });
}

/** Fetch biostats for all players in a single call */
async function fetchAllBioStats(): Promise<Map<number, number>> {
  const ageMap = new Map<number, number>();

  try {
    console.log("[SYNC-ROSTERS] Fetching bio stats from stats.nba.com (timeout 10min)...");
    const bioData = await fetchNba(
      "https://stats.nba.com/stats/leaguedashplayerbiostats?" +
        "College=&Conference=&Country=&DateFrom=&DateTo=&Division=" +
        "&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=" +
        "&ISTRound=&LastNGames=0&LeagueID=00&Location=&Month=0" +
        "&OpponentTeamID=0&Outcome=&PORound=0&PerMode=PerGame" +
        "&Period=0&PlayerExperience=&PlayerPosition=&Season=" + SEASON +
        "&SeasonSegment=&SeasonType=Regular+Season" +
        "&ShotClockRange=&StarterBench=&TeamID=0" +
        "&VsConference=&VsDivision=&Weight="
    );

    const headers = bioData.resultSets[0].headers;
    const pidIdx = headers.indexOf("PLAYER_ID");
    const ageIdx = headers.indexOf("AGE");
    for (const row of bioData.resultSets[0].rowSet) {
      const pid = Number(row[pidIdx]);
      const age = row[ageIdx] != null ? Number(row[ageIdx]) : null;
      if (pid && age) ageMap.set(pid, age);
    }
    console.log(`[SYNC-ROSTERS] Got ages for ${ageMap.size} players`);
  } catch (err) {
    console.error("[SYNC-ROSTERS] Bio stats fetch failed (non-fatal):", (err as Error).message);
  }

  return ageMap;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const startTime = Date.now();

  try {
    console.log("[SYNC-ROSTERS] Starting sync...");
    // Read active players from Supabase (already synced by sync-players)
    const { data: dbPlayers, error: dbError } = await supabase
      .from("players")
      .select("*")
      .eq("is_active", true);

    if (dbError || !dbPlayers || dbPlayers.length === 0) {
      throw new Error("No active players in database. Run sync-players first.");
    }
    console.log(`[SYNC-ROSTERS] Found ${dbPlayers.length} active players in database`);

    // Fetch bio stats (ages) and salaries in parallel
    console.log("[SYNC-ROSTERS] Fetching from NBA API and Basketball Reference...");
    const [ageMap, salaryResult] = await Promise.all([
      fetchAllBioStats(),
      (async () => {
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
        return { salaryMap, payrollMap };
      })(),
    ]);

    const { salaryMap, payrollMap } = salaryResult;
    console.log(`[SYNC-ROSTERS] Fetched ${ageMap.size} ages, ${salaryMap.size} salaries, ${payrollMap.size} payrolls`);

    const now = new Date().toISOString();
    const players = [];

    for (const p of dbPlayers) {
      if (!p.team_tricode) continue;

      const salaryKey = normalizeName(`${p.first_name} ${p.last_name}`) + "|" + p.team_tricode;
      const salary = salaryMap.get(salaryKey) || null;

      players.push({
        season: SEASON,
        player_id: p.player_id,
        first_name: p.first_name,
        last_name: p.last_name,
        team_tricode: p.team_tricode,
        team_name: p.team_name || "",
        team_city: p.team_city || "",
        jersey_number: p.jersey_number ?? "",
        position: p.position || "",
        height: p.height || "",
        weight: p.weight || "",
        age: ageMap.get(p.player_id) || null,
        college: p.college || "",
        country: p.country || "",
        draft_year: p.draft_year || null,
        draft_round: p.draft_round || null,
        draft_number: p.draft_number || null,
        pts: p.pts,
        reb: p.reb,
        ast: p.ast,
        salary,
        updated_at: now,
      });
    }

    // Upsert rosters (avoids emptying table on partial failures)
    console.log(`[SYNC-ROSTERS] Upserting ${players.length} rows into rosters...`);
    let inserted = 0;
    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      const batch = players.slice(i, i + BATCH_SIZE);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("rosters").upsert(batch as any, {
        onConflict: "player_id,season",
      });
      if (error) {
        console.error(`Batch upsert error at ${i}:`, error);
      } else {
        inserted += batch.length;
      }
    }

    // Store team payroll totals
    if (payrollMap.size > 0) {
      const payrollRows = Array.from(payrollMap.entries()).map(([tricode, payroll]) => ({
        season: SEASON,
        team_tricode: tricode,
        payroll,
        updated_at: now,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: payrollError } = await supabase.from("team_payrolls").upsert(payrollRows as any, {
        onConflict: "team_tricode,season",
      });
      if (payrollError) console.error("Payroll upsert error:", payrollError);
    }

    console.log(`[SYNC-ROSTERS] Upserted ${inserted} rows successfully`);
    revalidatePath("/equipes");
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC-ROSTERS] Completed at ${now} (took ${duration}s)`);

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
