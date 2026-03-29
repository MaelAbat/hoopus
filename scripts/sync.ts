/**
 * Script de synchronisation locale.
 * Lance le serveur Next.js en dev puis appelle chaque endpoint de sync.
 *
 * Usage:  npx tsx scripts/sync.ts
 *   ou:   npx tsx scripts/sync.ts stats team-stats
 */

const BASE_URL = "http://localhost:3002";

const ENDPOINTS = [
  { key: "games", label: "Matchs" },
  { key: "standings", label: "Classement" },
  { key: "playoffs", label: "Playoffs" },
  { key: "players", label: "Joueurs" },
  { key: "stats", label: "Statistiques" },
  { key: "team-stats", label: "Stats équipes" },
  { key: "rosters", label: "Effectifs" },
  { key: "career", label: "Carrières" },
];

async function main() {
  // Load .env.local
  const { config } = await import("dotenv");
  config({ path: ".env.local" });

  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) {
    console.error("❌ CRON_SECRET not found in .env.local");
    process.exit(1);
  }

  // Filter endpoints if args provided
  const args = process.argv.slice(2);
  const endpoints = args.length > 0
    ? ENDPOINTS.filter((e) => args.includes(e.key))
    : ENDPOINTS;

  if (endpoints.length === 0) {
    console.error("❌ No matching endpoints. Available:", ENDPOINTS.map((e) => e.key).join(", "));
    process.exit(1);
  }

  console.log(`\n🏀 Sync locale — ${endpoints.length} endpoint(s)\n`);
  console.log("⚠️  Assure-toi que le serveur dev tourne: npm run dev\n");

  const authParam = `cron_secret=${encodeURIComponent(cronSecret)}`;
  let succeeded = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    const start = Date.now();
    process.stdout.write(`  ⏳ ${endpoint.label}...`);

    try {
      const res = await fetch(`${BASE_URL}/api/sync-${endpoint.key}?${authParam}`);
      const data = await res.json();
      const duration = ((Date.now() - start) / 1000).toFixed(1);

      if (res.ok) {
        console.log(` ✅ (${duration}s)`);
        succeeded++;
      } else {
        console.log(` ❌ ${data.error || res.status} (${duration}s)`);
        failed++;
      }
    } catch (err) {
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      console.log(` ❌ ${(err as Error).message} (${duration}s)`);
      failed++;
    }
  }

  console.log(`\n📊 Résultat: ${succeeded} OK, ${failed} échec(s)\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
