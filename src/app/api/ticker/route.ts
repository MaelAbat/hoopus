import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isEspnGameId } from "@/lib/espn-teams";
import { easternNow, mayHaveStarted, refreshEspnDays } from "@/lib/live-refresh";
import { loadTicker } from "@/lib/ticker";

export const dynamic = "force-dynamic";

/**
 * Bandeau des scores, pour toutes les pages.
 *
 * Le CDN de Vercel garde la réponse : une seule exécution par période, quel que
 * soit le nombre de visiteurs. Elle est courte tant qu'un match est en cours ou
 * sur le point de commencer, plus longue le reste du temps.
 */
const LIVE_CACHE_S = 20;
const IDLE_CACHE_S = 120;

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let data = await loadTicker(supabase);

  // Un match dont l'heure est passée et qui n'est pas terminé est relu chez
  // ESPN : c'est ainsi qu'un match « à venir » passe en direct sans attendre
  // qu'un visiteur ouvre sa page.
  const now = easternNow();
  const pending = (games: typeof data.results) =>
    games.filter((g) => isEspnGameId(g.game_id) && g.status !== 3 && mayHaveStarted(g, now));
  const dates = [...pending(data.results), ...pending(data.upcoming)].map((g) => g.game_date);
  if (dates.length > 0 && (await refreshEspnDays(supabase, dates))) {
    data = await loadTicker(supabase);
  }

  const live = pending(data.results).length > 0 || pending(data.upcoming).length > 0;
  const maxAge = live ? LIVE_CACHE_S : IDLE_CACHE_S;

  return NextResponse.json(
    { ...data, live },
    { headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}` } }
  );
}
