import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SEASON = "2025-26";
const SEASON_YEAR = 2026; // BR uses the end year
const BATCH_SIZE = 200;

/* ─── Team info mapping (BR tricode → NBA data) ─── */
const TEAM_INFO: Record<string, { tricode: string; name: string; city: string }> = {
  ATL: { tricode: "ATL", name: "Hawks", city: "Atlanta" },
  BOS: { tricode: "BOS", name: "Celtics", city: "Boston" },
  BRK: { tricode: "BKN", name: "Nets", city: "Brooklyn" },
  CHI: { tricode: "CHI", name: "Bulls", city: "Chicago" },
  CHO: { tricode: "CHA", name: "Hornets", city: "Charlotte" },
  CLE: { tricode: "CLE", name: "Cavaliers", city: "Cleveland" },
  DAL: { tricode: "DAL", name: "Mavericks", city: "Dallas" },
  DEN: { tricode: "DEN", name: "Nuggets", city: "Denver" },
  DET: { tricode: "DET", name: "Pistons", city: "Detroit" },
  GSW: { tricode: "GSW", name: "Warriors", city: "Golden State" },
  HOU: { tricode: "HOU", name: "Rockets", city: "Houston" },
  IND: { tricode: "IND", name: "Pacers", city: "Indiana" },
  LAC: { tricode: "LAC", name: "Clippers", city: "Los Angeles" },
  LAL: { tricode: "LAL", name: "Lakers", city: "Los Angeles" },
  MEM: { tricode: "MEM", name: "Grizzlies", city: "Memphis" },
  MIA: { tricode: "MIA", name: "Heat", city: "Miami" },
  MIL: { tricode: "MIL", name: "Bucks", city: "Milwaukee" },
  MIN: { tricode: "MIN", name: "Timberwolves", city: "Minnesota" },
  NOP: { tricode: "NOP", name: "Pelicans", city: "New Orleans" },
  NYK: { tricode: "NYK", name: "Knicks", city: "New York" },
  OKC: { tricode: "OKC", name: "Thunder", city: "Oklahoma City" },
  ORL: { tricode: "ORL", name: "Magic", city: "Orlando" },
  PHI: { tricode: "PHI", name: "76ers", city: "Philadelphia" },
  PHO: { tricode: "PHX", name: "Suns", city: "Phoenix" },
  POR: { tricode: "POR", name: "Trail Blazers", city: "Portland" },
  SAC: { tricode: "SAC", name: "Kings", city: "Sacramento" },
  SAS: { tricode: "SAS", name: "Spurs", city: "San Antonio" },
  TOR: { tricode: "TOR", name: "Raptors", city: "Toronto" },
  UTA: { tricode: "UTA", name: "Jazz", city: "Utah" },
  WAS: { tricode: "WAS", name: "Wizards", city: "Washington" },
};

/* ─── HTML fetching ─── */
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

/* ─── Salary scraping from Basketball Reference ─── */
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

/* ─── Roster + per-game stats scraping from Basketball Reference ─── */
interface BRPlayer {
  name: string;
  jersey: string;
  position: string;
  height: string;
  weight: string;
  birthDate: string | null;
  college: string;
  country: string;
  brTeam: string;
}

interface BRPerGame {
  pts: number | null;
  reb: number | null;
  ast: number | null;
}

function extractCellText(row: string, dataStat: string): string {
  const re = new RegExp(`data-stat="${dataStat}"[^>]*>([\\s\\S]*?)</td>`);
  const match = row.match(re);
  if (!match) return "";
  // Strip HTML tags to get text content
  return match[1].replace(/<[^>]+>/g, "").trim();
}

function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const parsed = new Date(birthDate);
  if (isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
    age--;
  }
  return age;
}

function parseTeamRoster(html: string, brTeam: string): BRPlayer[] {
  const players: BRPlayer[] = [];

  // Find the roster table — it's the one with id="roster"
  const tableMatch = html.match(/<table[^>]*id="roster"[^>]*>[\s\S]*?<\/table>/);
  if (!tableMatch) return players;
  const table = tableMatch[0];

  const rows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];

  for (const row of rows) {
    // Skip header rows
    if (row.includes("<th")) continue;

    const playerCell = row.match(/data-stat="player"[^>]*>([\s\S]*?)<\/td>/);
    if (!playerCell) continue;
    // Extract player name from <a> tag
    const nameMatch = playerCell[1].match(/<a[^>]*>([^<]+)<\/a>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();

    const jersey = extractCellText(row, "number");
    const country = extractCellText(row, "nationality");
    const position = extractCellText(row, "pos");
    const height = extractCellText(row, "height");
    const weight = extractCellText(row, "weight");

    // Birth date: extract from the csk attribute for reliable parsing
    let birthDate: string | null = null;
    const birthCskMatch = row.match(/data-stat="birth_date"[^>]*csk="([^"]+)"/);
    if (birthCskMatch) {
      birthDate = birthCskMatch[1]; // format: YYYY-MM-DD
    } else {
      // Fallback: extract text
      const birthText = extractCellText(row, "birth_date");
      if (birthText) birthDate = birthText;
    }

    // College: try both "colleges" and "college_name" data-stat
    let college = extractCellText(row, "colleges");
    if (!college) college = extractCellText(row, "college_name");

    players.push({
      name,
      jersey,
      position,
      height,
      weight,
      birthDate,
      college,
      country,
      brTeam,
    });
  }

  return players;
}

function parseTeamPerGame(html: string): Map<string, BRPerGame> {
  const statsMap = new Map<string, BRPerGame>();

  // Find the per_game table
  const tableMatch = html.match(/<table[^>]*id="per_game"[^>]*>[\s\S]*?<\/table>/);
  if (!tableMatch) return statsMap;
  const table = tableMatch[0];

  const rows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];

  for (const row of rows) {
    if (row.includes("<th")) continue;
    const playerCell = row.match(/data-stat="player"[^>]*>([\s\S]*?)<\/td>/);
    if (!playerCell) continue;
    const nameMatch = playerCell[1].match(/<a[^>]*>([^<]+)<\/a>/);
    if (!nameMatch) continue;
    const name = normalizeName(nameMatch[1].trim());

    const ptsText = extractCellText(row, "pts_per_g");
    const rebText = extractCellText(row, "trb_per_g");
    const astText = extractCellText(row, "ast_per_g");

    statsMap.set(name, {
      pts: ptsText ? parseFloat(ptsText) : null,
      reb: rebText ? parseFloat(rebText) : null,
      ast: astText ? parseFloat(astText) : null,
    });
  }

  return statsMap;
}

interface TeamScrapeResult {
  roster: BRPlayer[];
  perGame: Map<string, BRPerGame>;
}

async function fetchTeamPage(brTeam: string): Promise<TeamScrapeResult> {
  const url = `https://www.basketball-reference.com/teams/${brTeam}/${SEASON_YEAR}.html`;
  const html = await fetchHtml(url);

  // BR wraps some tables in comments; uncomment them
  const uncommented = html.replace(/<!--\s*([\s\S]*?)-->/g, "$1");

  return {
    roster: parseTeamRoster(uncommented, brTeam),
    perGame: parseTeamPerGame(uncommented),
  };
}

async function fetchAllTeamPages(): Promise<TeamScrapeResult[]> {
  const results: TeamScrapeResult[] = [];

  // Fetch in batches of 5 with 3s delay between batches
  for (let i = 0; i < BR_TEAMS.length; i += 5) {
    const batch = BR_TEAMS.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(team =>
        fetchTeamPage(team).catch(err => {
          console.error(`Roster scrape failed for ${team}:`, err.message);
          return { roster: [], perGame: new Map<string, BRPerGame>() } as TeamScrapeResult;
        })
      )
    );
    results.push(...batchResults);
    if (i + 5 < BR_TEAMS.length) await delay(3000);
  }

  console.log(`Roster scraping: scraped ${BR_TEAMS.length} team pages`);
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

  try {
    // 1. Query existing data from Supabase for player IDs and draft info
    const [playersResult, rostersResult] = await Promise.all([
      supabase.from("players").select("player_id, first_name, last_name"),
      supabase.from("rosters").select("player_id, first_name, last_name, draft_year, draft_round, draft_number").eq("season", SEASON),
    ]);

    // Build name → player_id map from players table
    const playerIdMap = new Map<string, number>();
    if (playersResult.data) {
      for (const p of playersResult.data) {
        const key = normalizeName(`${p.first_name} ${p.last_name}`);
        playerIdMap.set(key, p.player_id);
      }
    }
    console.log(`Player ID map: ${playerIdMap.size} players from players table`);

    // Build name → draft info map from existing rosters
    const draftMap = new Map<string, { draft_year: number | null; draft_round: number | null; draft_number: number | null }>();
    if (rostersResult.data) {
      for (const r of rostersResult.data) {
        const key = normalizeName(`${r.first_name} ${r.last_name}`);
        draftMap.set(key, {
          draft_year: r.draft_year,
          draft_round: r.draft_round,
          draft_number: r.draft_number,
        });
      }
    }
    console.log(`Draft info map: ${draftMap.size} players from existing rosters`);

    // 2. Scrape Basketball Reference team pages for roster + per-game stats
    // Also scrape salaries and payrolls in parallel
    const [teamResults, salaryMap, payrollMap] = await Promise.all([
      fetchAllTeamPages(),
      fetchSalaries().catch(err => {
        console.error("Salary scraping failed (non-fatal):", err);
        return new Map<string, string>();
      }),
      fetchTeamPayrolls().catch(err => {
        console.error("Payroll scraping failed (non-fatal):", err);
        return new Map<string, number>();
      }),
    ]);

    // 3. Build player records
    const now = new Date().toISOString();
    const players = [];
    let unmatchedCount = 0;

    for (const { roster, perGame } of teamResults) {
      for (const p of roster) {
        const info = TEAM_INFO[p.brTeam];
        if (!info) continue;

        const nbaTricode = info.tricode;
        const normalizedName = normalizeName(p.name);

        // Split name into first/last
        const nameParts = p.name.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        // Look up player_id
        const playerId = playerIdMap.get(normalizedName);
        if (!playerId) {
          unmatchedCount++;
          console.warn(`No player_id found for: ${p.name} (${nbaTricode})`);
          continue; // skip players we can't match — they need to be in the players table
        }

        // Look up draft info from existing data
        const draft = draftMap.get(normalizedName);

        // Look up per-game stats
        const stats = perGame.get(normalizedName);

        // Look up salary
        const salaryKey = normalizedName + "|" + nbaTricode;
        const salary = salaryMap.get(salaryKey) || null;

        // Calculate age from birth date
        const age = p.birthDate ? calculateAge(p.birthDate) : null;

        players.push({
          season: SEASON,
          player_id: playerId,
          first_name: firstName,
          last_name: lastName,
          team_tricode: nbaTricode,
          team_name: info.name,
          team_city: info.city,
          jersey_number: p.jersey,
          position: p.position,
          height: p.height,
          weight: p.weight,
          age,
          college: p.college,
          country: p.country,
          draft_year: draft?.draft_year ?? null,
          draft_round: draft?.draft_round ?? null,
          draft_number: draft?.draft_number ?? null,
          pts: stats?.pts ?? null,
          reb: stats?.reb ?? null,
          ast: stats?.ast ?? null,
          salary,
          updated_at: now,
        });
      }
    }

    if (unmatchedCount > 0) {
      console.warn(`${unmatchedCount} players could not be matched to a player_id and were skipped`);
    }

    // 4. Clear and reinsert rosters
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

    // 5. Store team payroll totals
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
      unmatched: unmatchedCount,
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
