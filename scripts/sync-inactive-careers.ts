/**
 * One-time script: sync career stats for ALL inactive NBA players.
 * Fetches base + advanced stats + adjusted shooting for each player.
 *
 * Usage:  npm run sync:inactive
 *
 * This calls the NBA API directly (no Next.js server needed).
 * Expect this to take several hours for thousands of players.
 * Progress is saved as it goes — safe to interrupt and re-run
 * (players already synced with advanced stats will be skipped).
 */

import https from "node:https";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { syncPlayerCareer } from "../src/lib/sync-career";
import { getCurrentSeason } from "../src/lib/season";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

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

interface AllPlayersResponse {
  resultSets: { headers: string[]; rowSet: (string | number)[][] }[];
}

function fetchAllPlayers(): Promise<AllPlayersResponse> {
  return new Promise((resolve, reject) => {
    const url =
      `https://stats.nba.com/stats/commonallplayers?IsOnlyCurrentSeason=0&LeagueID=00&Season=${getCurrentSeason()}`;
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
          reject(new Error("Parse error"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("\n  Sync carrieres joueurs inactifs\n");

  // 1. Fetch all NBA players ever
  console.log("  Chargement de tous les joueurs NBA...");
  const allData = await fetchAllPlayers();
  const rs = allData.resultSets[0];
  const h = rs.headers;
  const ii = (name: string) => h.indexOf(name);

  const personIdIdx = ii("PERSON_ID");
  const rosterStatusIdx = ii("ROSTERSTATUS");
  const toYearIdx = ii("TO_YEAR");
  const nameIdx = ii("DISPLAY_FIRST_LAST");

  // Filter: inactive players (ROSTERSTATUS = 0), all eras
  // Note: adjusted shooting (TS+, eFG+, etc.) will be 0 for seasons before 1996-97
  // (no league averages available), but base + advanced stats will still be synced.
  const inactivePlayers = rs.rowSet.filter((row) => {
    return Number(row[rosterStatusIdx]) === 0;
  });

  console.log(`  ${rs.rowSet.length} joueurs totaux, ${inactivePlayers.length} inactifs\n`);

  // 2. Find which players already have career stats (skip them)
  // Query in pages since there could be many rows
  const alreadySyncedSet = new Set<number>();
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("player_career_stats")
      .select("player_id")
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) alreadySyncedSet.add(r.player_id);
    if (data.length < 1000) break;
    from += 1000;
  }

  const toSync = inactivePlayers.filter(
    (row) => !alreadySyncedSet.has(Number(row[personIdIdx]))
  );

  console.log(`  ${alreadySyncedSet.size} joueurs deja synces avec stats avancees`);
  console.log(`  ${toSync.length} joueurs a synchroniser\n`);

  if (toSync.length === 0) {
    console.log("  Rien a faire !\n");
    process.exit(0);
  }

  // 3. Sync each player
  let synced = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < toSync.length; i++) {
    const row = toSync[i];
    const pid = Number(row[personIdIdx]);
    const name = String(row[nameIdx]);

    try {
      const seasons = await syncPlayerCareer(pid);
      if (seasons.length > 0) {
        console.log(`  [${i + 1}/${toSync.length}] ${name} (${pid}) — ${seasons.length} saisons OK`);
        synced++;
      } else {
        console.log(`  [${i + 1}/${toSync.length}] ${name} (${pid}) — aucune saison trouvee`);
        failed++;
      }
    } catch (err) {
      console.log(`  [${i + 1}/${toSync.length}] ${name} (${pid}) — ERREUR: ${(err as Error).message}`);
      failed++;
    }

    // Summary every 100 players
    if ((i + 1) % 100 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const rate = (i + 1) / ((Date.now() - startTime) / 1000 / 60);
      const remaining = ((toSync.length - i - 1) / rate).toFixed(0);
      console.log(
        `\n  --- Resume: ${i + 1}/${toSync.length} (synced: ${synced}, failed: ${failed}) ` +
        `[${elapsed}min, ~${remaining}min restantes] ---\n`
      );
    }

    // Rate limiting: 3s between players (2 sequential API calls each)
    // Higher delay to avoid NBA API throttling over long runs
    if (i < toSync.length - 1) {
      await sleep(3000);
    }
  }

  const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n  Termine en ${totalMin} minutes`);
  console.log(`  Resultat: ${synced} synces, ${failed} echec(s)\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
