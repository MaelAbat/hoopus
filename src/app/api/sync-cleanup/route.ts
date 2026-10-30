import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";

/**
 * Supprime les comptes anonymes abandonnés : sans activité depuis 30 jours et
 * sans aucun score (voir la migration 056). Un passage par jour, en fin de cron :
 * la requête ne touche presque toujours rien.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc("purge_stale_anonymous_users", { inactive_days: 30 });
  if (error) {
    console.error("[SYNC-CLEANUP] Purge impossible :", error.message);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  console.log(`[SYNC-CLEANUP] ${data ?? 0} compte(s) anonyme(s) abandonné(s) supprimé(s)`);
  return NextResponse.json({ ok: true, removed: data ?? 0, timestamp: new Date().toISOString() });
}
