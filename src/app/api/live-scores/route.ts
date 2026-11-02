import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBoxscore } from "@/lib/sync-boxscore";
import { isEspnGameId } from "@/lib/espn-teams";
import { SYNC_STALE_MS, easternNow, mayHaveStarted, refreshEspnDays } from "@/lib/live-refresh";

export const dynamic = "force-dynamic";

const SELECT = "game_id, game_date, game_time, status, status_text, home_score, away_score, updated_at";

/** Identifiant NBA (10 chiffres) ou ESPN (`E` suivi de l'identifiant ESPN). */
const GAME_ID = /^(\d{10}|E\d{6,12})$/;

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids");
  const ids = idsParam
    ? idsParam.split(",").map((s) => s.trim()).filter((s) => GAME_ID.test(s))
    : null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const query =
    ids && ids.length > 0
      ? supabase.from("games").select(SELECT).in("game_id", ids)
      : supabase.from("games").select(SELECT).eq("status", 2);

  const { data } = await query;
  let games = data || [];

  // NBA : un box score par match en cours, qui met aussi le score à jour.
  const nowMs = Date.now();
  const staleNba = games.filter(
    (g) => !isEspnGameId(g.game_id) && g.status === 2 && nowMs - new Date(g.updated_at).getTime() > SYNC_STALE_MS
  );

  // ESPN : un match encore « à venir » dont l'heure est passée est relu lui
  // aussi — c'est ainsi qu'il passe en direct sans attendre la sync suivante.
  const now = easternNow();
  const espnDates = [
    ...new Set(
      games
        .filter((g) => isEspnGameId(g.game_id) && g.status !== 3 && mayHaveStarted(g, now))
        .map((g) => g.game_date)
    ),
  ];

  const [, espnRefreshed] = await Promise.all([
    Promise.all(staleNba.map((g) => syncBoxscore(g.game_id))),
    refreshEspnDays(supabase, espnDates),
  ]);

  if (staleNba.length > 0 || espnRefreshed) {
    const refreshedIds = games
      .filter((g) => staleNba.includes(g) || espnDates.includes(g.game_date))
      .map((g) => g.game_id);
    const { data: refreshed } = await supabase.from("games").select(SELECT).in("game_id", refreshedIds);
    const map = new Map((refreshed || []).map((g) => [g.game_id, g]));
    games = games.map((g) => map.get(g.game_id) ?? g);
  }

  return NextResponse.json(
    {
      games: games.map((g) => ({
        game_id: g.game_id,
        status: g.status,
        status_text: g.status_text,
        home_score: g.home_score,
        away_score: g.away_score,
      })),
    },
    // Mis en cache par le CDN de Vercel : tous les visiteurs d'un même match
    // partagent une exécution toutes les quinze secondes, au lieu d'une par
    // onglet ouvert.
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15" } }
  );
}
