import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { fetchLeagueState } from "@/lib/league-season";
import { isCronAuthorized } from "@/lib/cron-auth";
import { syncSeasonTransactions } from "@/lib/market-sync";

/**
 * Mouvements de la saison courante.
 *
 * Deux pages de Basketball Reference au maximum, soit quelques secondes : c'est
 * assez léger pour tourner chaque jour, contrairement au rattrapage historique
 * qui passe par `npm run sync:market` (une page par saison, largement au-delà de
 * la minute allouée à une fonction).
 *
 * L'intersaison est le moment où cette route compte le plus : c'est là que tout
 * bouge, et là que le site n'a autrement rien à raconter.
 */
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
    const season = (await fetchLeagueState()).currentSeason;
    console.log(`[SYNC-TRANSACTIONS] Saison ${season}`);

    const result = await syncSeasonTransactions(supabase, season, (message) =>
      console.log(`[SYNC-TRANSACTIONS] ${message}`)
    );

    revalidatePath("/marche");
    revalidatePath("/");

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[SYNC-TRANSACTIONS] ${result.written}/${result.fetched} mouvements écrits, ` +
        `${result.playersResolved} joueurs reliés, saisons ${result.seasonsTouched.join(", ")} (${duration}s)`
    );

    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[SYNC-TRANSACTIONS] Erreur:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
