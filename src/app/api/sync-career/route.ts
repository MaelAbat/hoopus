import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { syncPlayerCareer, syncPlayerCareerQuick, overrideLeagueAvg } from "@/lib/sync-career";
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

  // Load live league averages from DB (written by sync-stats) to override hardcoded values
  const { data: liveAvg } = await supabase
    .from("league_averages")
    .select("fg, fg2, fg3, efg, ft, ts")
    .eq("season", CURRENT_SEASON)
    .single();

  if (liveAvg) {
    const avg = {
      fg: Number(liveAvg.fg),
      fg2: Number(liveAvg.fg2),
      fg3: Number(liveAvg.fg3),
      efg: Number(liveAvg.efg),
      ft: Number(liveAvg.ft),
      ts: Number(liveAvg.ts),
    };
    overrideLeagueAvg(CURRENT_SEASON, avg);
    console.log(`[SYNC-CAREER] Live league averages for ${CURRENT_SEASON}: FG=${avg.fg} FG2=${avg.fg2} FG3=${avg.fg3} eFG=${avg.efg} FT=${avg.ft} TS=${avg.ts}`);
  } else {
    console.log(`[SYNC-CAREER] No live league averages found for ${CURRENT_SEASON}, using hardcoded values`);
  }

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

  // force_full=true forces a full career sync for ALL players (needed for HoopLink game)
  const forceFull = request.nextUrl.searchParams.get("force_full") === "true";

  // Find players who already have career stats in DB
  // These only need a quick base-stats update for current season (1 API call)
  // Unless force_full is set, then everyone gets a full sync
  const hasCareerSet = new Set<number>();
  if (!forceFull) {
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from("player_career_stats")
        .select("player_id")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const r of data) hasCareerSet.add(r.player_id);
      if (data.length < 1000) break;
      from += 1000;
    }
  }

  const fullSyncCount = activePlayers.filter((p) => !hasCareerSet.has(p.player_id)).length;
  const quickSyncCount = activePlayers.length - fullSyncCount;
  console.log(`[SYNC-CAREER] ${forceFull ? "FORCE FULL MODE - " : ""}${quickSyncCount} players: quick update (1 API call), ${fullSyncCount} players: full sync (2 API calls)`);

  let synced = 0;
  let failed = 0;

  // Process in parallel batches of 3 for quick, 1 at a time for full
  const BATCH_SIZE = 3;

  for (let i = 0; i < activePlayers.length; ) {
    // Collect next batch of quick players (up to BATCH_SIZE)
    const batch: { player_id: number; first_name: string; last_name: string }[] = [];
    while (batch.length < BATCH_SIZE && i < activePlayers.length) {
      if (hasCareerSet.has(activePlayers[i].player_id)) {
        batch.push(activePlayers[i]);
        i++;
      } else {
        // Full sync player — process alone
        break;
      }
    }

    if (batch.length > 0) {
      // Process quick batch in parallel
      const results = await Promise.allSettled(
        batch.map((p) => syncPlayerCareerQuick(p.player_id, CURRENT_SEASON))
      );
      results.forEach((r, j) => {
        const p = batch[j];
        const name = `${p.first_name} ${p.last_name}`.trim();
        if (r.status === "fulfilled") {
          console.log(`[SYNC-CAREER] ${name} — OK (quick)`);
          synced++;
        } else {
          console.log(`[SYNC-CAREER] ${name} — ERREUR (quick)`);
          failed++;
        }
      });
      await sleep(1000);
    } else if (i < activePlayers.length) {
      // Full sync — one at a time
      const p = activePlayers[i];
      const name = `${p.first_name} ${p.last_name}`.trim();
      try {
        await syncPlayerCareer(p.player_id);
        console.log(`[SYNC-CAREER] ${name} — OK (full)`);
        synced++;
      } catch {
        console.log(`[SYNC-CAREER] ${name} — ERREUR (full)`);
        failed++;
      }
      i++;
      await sleep(1500);
    }

    // Log progress
    if (i % 50 === 0 || i === activePlayers.length) {
      console.log(`[SYNC-CAREER] Progress: ${i}/${activePlayers.length} (synced: ${synced}, failed: ${failed})`);
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
