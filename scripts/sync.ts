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

// Endpoints rapides (CDN/ESPN, pas de rate limit) — peuvent tourner en parallele
const PARALLEL_ENDPOINTS = [
  { key: "games", label: "Matchs" },
  { key: "standings", label: "Classement" },
  { key: "playoffs", label: "Playoffs" },
  { key: "injuries", label: "Blessures" },
];

// Endpoints lents (stats.nba.com, rate limited) — doivent tourner sequentiellement
const SEQUENTIAL_ENDPOINTS = [
  { key: "players", label: "Joueurs" },
  { key: "rosters", label: "Effectifs" },
  { key: "stats", label: "Statistiques" },
  { key: "team-stats", label: "Stats equipes" },
  { key: "career", label: "Carrieres" },
];

const ALL_ENDPOINTS = [...PARALLEL_ENDPOINTS, ...SEQUENTIAL_ENDPOINTS];

async function main() {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });

  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) {
    console.error("CRON_SECRET not found in .env.local");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const isSubset = args.length > 0;
  const selectedEndpoints = isSubset
    ? ALL_ENDPOINTS.filter((e) => args.includes(e.key))
    : ALL_ENDPOINTS;

  if (selectedEndpoints.length === 0) {
    console.error("No matching endpoints. Available:", ALL_ENDPOINTS.map((e) => e.key).join(", "));
    process.exit(1);
  }

  console.log(`\n  Sync saison en cours — ${selectedEndpoints.length} endpoint(s)\n`);
  console.log("  Assure-toi que le serveur dev tourne: npm run dev\n");

  const authParam = `cron_secret=${encodeURIComponent(cronSecret)}`;
  const results: { label: string; ok: boolean; duration: string; detail?: string }[] = [];
  const totalStart = Date.now();

  async function runEndpoint(endpoint: { key: string; label: string }) {
    const start = Date.now();
    process.stdout.write(`  ${endpoint.label}...`);
    try {
      const url = `${BASE_URL}/api/sync-${endpoint.key}?${authParam}`;
      const data = await httpGet(url);
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      if (data.ok) {
        console.log(` OK (${duration}s)`);
        results.push({ label: endpoint.label, ok: true, duration });
      } else {
        console.log(` FAIL ${data.error || "unknown"} (${duration}s)`);
        results.push({ label: endpoint.label, ok: false, duration, detail: String(data.error || "unknown") });
      }
    } catch (err) {
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      console.log(` FAIL ${(err as Error).message} (${duration}s)`);
      results.push({ label: endpoint.label, ok: false, duration, detail: (err as Error).message });
    }
  }

  // Phase 1: endpoints rapides en parallele (CDN/ESPN)
  const parallelToRun = selectedEndpoints.filter((e) => PARALLEL_ENDPOINTS.some((p) => p.key === e.key));
  const sequentialToRun = selectedEndpoints.filter((e) => SEQUENTIAL_ENDPOINTS.some((s) => s.key === e.key));

  if (parallelToRun.length > 0) {
    console.log("  --- Rapides (parallele) ---");
    await Promise.all(parallelToRun.map(runEndpoint));
    console.log("");
  }

  // Phase 2: endpoints lents sequentiellement (NBA API)
  if (sequentialToRun.length > 0) {
    console.log("  --- NBA API (sequentiel) ---");
    for (const endpoint of sequentialToRun) {
      await runEndpoint(endpoint);
    }
  }

  // Recap
  const succeeded = results.filter((r) => r.ok).length;
  const failedCount = results.filter((r) => !r.ok).length;
  const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(1);

  console.log(`\n  ─── Recap ───`);
  for (const r of results) {
    console.log(`  ${r.ok ? "OK" : "FAIL"}  ${r.label} (${r.duration}s)${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`\n  ${succeeded} OK, ${failedCount} echec(s) — total ${totalDuration}s\n`);

  process.exit(failedCount > 0 ? 1 : 0);
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
