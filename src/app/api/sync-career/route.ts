import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { syncPlayerCareer, syncPlayerCareerQuick } from "@/lib/sync-career";
import { getCurrentSeason } from "@/lib/season";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

  const startTime = Date.now();
  console.log("[SYNC-CAREER] Starting sync...");

  // Optional: sync a single player (always full sync)
  const singleId = request.nextUrl.searchParams.get("player_id");
  if (singleId && /^\d+$/.test(singleId)) {
    try {
      console.log(`[SYNC-CAREER] Fetching single player ${singleId} from NBA API...`);
      const rows = await syncPlayerCareer(Number(singleId));
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[SYNC-CAREER] Completed at ${new Date().toISOString()} (took ${duration}s)`);
      return NextResponse.json({ ok: true, player_id: singleId, seasons: rows.length });
    } catch (err) {
      console.error(`[SYNC-CAREER] Error fetching player ${singleId}:`, err);
      return NextResponse.json({ error: (err as Error).message }, { status: 502 });
    }
  }

  const CURRENT_SEASON = getCurrentSeason();

  // Bulk: sync all active players
  const { data: activePlayers } = await supabase
    .from("players")
    .select("player_id, first_name, last_name")
    .eq("is_active", true);

  if (!activePlayers || activePlayers.length === 0) {
    console.log("[SYNC-CAREER] No active players found, skipping");
    return NextResponse.json({ ok: true, synced: 0, message: "No active players" });
  }
  console.log(`[SYNC-CAREER] Found ${activePlayers.length} active players to sync`);

  // Find players who already have advanced stats (off_rating > 0 for any row)
  // These only need a quick base-stats update for current season (1 API call)
  const { data: playersWithAdvanced } = await supabase
    .from("player_career_stats")
    .select("player_id")
    .gt("off_rating", 0);

  const hasAdvancedSet = new Set(
    (playersWithAdvanced || []).map((r) => r.player_id)
  );

  const fullSyncCount = activePlayers.filter((p) => !hasAdvancedSet.has(p.player_id)).length;
  const quickSyncCount = activePlayers.length - fullSyncCount;
  console.log(`[SYNC-CAREER] ${quickSyncCount} players: quick update (1 API call), ${fullSyncCount} players: full sync (2 API calls)`);

  let synced = 0;
  let failed = 0;

  for (let i = 0; i < activePlayers.length; i++) {
    const pid = activePlayers[i].player_id;
    const name = `${activePlayers[i].first_name} ${activePlayers[i].last_name}`.trim() || pid;
    const hasAdvanced = hasAdvancedSet.has(pid);
    const mode = hasAdvanced ? "quick" : "full";

    try {
      if (hasAdvanced) {
        await syncPlayerCareerQuick(pid, CURRENT_SEASON);
      } else {
        await syncPlayerCareer(pid);
      }
      console.log(`[SYNC-CAREER] [${i + 1}/${activePlayers.length}] ${name} — OK (${mode})`);
      synced++;
    } catch (err) {
      console.log(`[SYNC-CAREER] [${i + 1}/${activePlayers.length}] ${name} — ERREUR: ${(err as Error).message} (${mode})`);
      failed++;
    }

    // Rate limiting: 700ms for quick (1 call), 1.5s for full (new players only)
    if (i < activePlayers.length - 1) {
      await sleep(hasAdvanced ? 700 : 1500);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[SYNC-CAREER] Completed at ${new Date().toISOString()} (took ${duration}s) - synced: ${synced}, failed: ${failed}`);

  return NextResponse.json({
    ok: true,
    total: activePlayers.length,
    synced,
    failed,
  });
}
