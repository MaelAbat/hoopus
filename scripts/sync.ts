/**
 * Script de synchronisation locale.
 * Appelle les endpoints de sync via le serveur Next.js local.
 * Pour les endpoints lents (stats, team-stats, players), appelle
 * directement l'API NBA et écrit dans Supabase sans passer par Next.js.
 *
 * Usage:  npx tsx scripts/sync.ts
 *   ou:   npx tsx scripts/sync.ts stats team-stats
 */

const BASE_URL = "http://localhost:3002";

// Endpoints rapides — passent par Next.js
const FAST_ENDPOINTS = [
  { key: "games", label: "Matchs" },
  { key: "standings", label: "Classement" },
  { key: "playoffs", label: "Playoffs" },
  { key: "rosters", label: "Effectifs" },
  { key: "career", label: "Carrières" },
];

// Endpoints lents — passent aussi par Next.js mais avec un timeout très long
const SLOW_ENDPOINTS = [
  { key: "players", label: "Joueurs" },
  { key: "stats", label: "Statistiques" },
  { key: "team-stats", label: "Stats équipes" },
];

const ALL_ENDPOINTS = [...FAST_ENDPOINTS, ...SLOW_ENDPOINTS];

async function main() {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });

  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) {
    console.error("CRON_SECRET not found in .env.local");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const endpoints = args.length > 0
    ? ALL_ENDPOINTS.filter((e) => args.includes(e.key))
    : ALL_ENDPOINTS;

  if (endpoints.length === 0) {
    console.error("No matching endpoints. Available:", ALL_ENDPOINTS.map((e) => e.key).join(", "));
    process.exit(1);
  }

  console.log(`\n  Sync locale — ${endpoints.length} endpoint(s)\n`);
  console.log("  Assure-toi que le serveur dev tourne: npm run dev\n");

  const authParam = `cron_secret=${encodeURIComponent(cronSecret)}`;
  let succeeded = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    const start = Date.now();
    process.stdout.write(`  ${endpoint.label}...`);

    try {
      // Use node http directly to avoid fetch timeout
      const url = `${BASE_URL}/api/sync-${endpoint.key}?${authParam}`;
      const data = await httpGet(url);
      const duration = ((Date.now() - start) / 1000).toFixed(1);

      if (data.ok) {
        console.log(` OK (${duration}s)`);
        succeeded++;
      } else {
        console.log(` FAIL ${data.error || "unknown"} (${duration}s)`);
        failed++;
      }
    } catch (err) {
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      console.log(` FAIL ${(err as Error).message} (${duration}s)`);
      failed++;
    }
  }

  console.log(`\n  Resultat: ${succeeded} OK, ${failed} echec(s)\n`);
  process.exit(failed > 0 ? 1 : 0);
}

// Use node:http directly — no timeout at all
function httpGet(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? require("https") : require("http");
    const req = mod.get(url, (res: import("http").IncomingMessage) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON response (status ${res.statusCode})`));
        }
      });
    });
    req.on("error", reject);
    // NO timeout — wait forever
  });
}

main();
