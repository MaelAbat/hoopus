import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { fetchLeagueState } from "@/lib/league-season";
import { isCronAuthorized } from "@/lib/cron-auth";
import { isUpstreamUnavailable } from "@/lib/upstream";
import { fetchSeasonGames, type GameRow } from "@/lib/espn-schedule";

/**
 * Calendrier et scores de la saison en cours, lus chez ESPN.
 *
 * La NBA refuse nos accès à son CDN et à stats.nba.com depuis l'été 2026 : les
 * saisons précédentes restent en base avec leurs identifiants NBA, la saison en
 * cours arrive d'ESPN (voir lib/espn-schedule). Les scores des matchs terminés
 * sont dans le même document, chaque sync les remet donc à jour.
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
    // ESPN désigne une saison par son année de fin : 2026-27 → 2027.
    const espnYear = Number(season.slice(0, 4)) + 1;
    console.log(`[SYNC-GAMES] Calendrier ${season} depuis ESPN...`);

    const games: GameRow[] = await fetchSeasonGames(espnYear, 2);

    // Play-in et playoffs : seulement une fois la saison régulière achevée,
    // pour ne pas doubler le nombre d'appels pendant six mois pour rien.
    const today = new Date().toISOString().slice(0, 10);
    const lastRegular = games.reduce((max, g) => (g.game_date > max ? g.game_date : max), "");
    if (lastRegular && lastRegular < today) {
      games.push(...(await fetchSeasonGames(espnYear, 5)), ...(await fetchSeasonGames(espnYear, 3)));
    }

    console.log(`[SYNC-GAMES] ${games.length} matchs lus, écriture...`);

    let inserted = 0;
    for (let i = 0; i < games.length; i += 200) {
      const batch = games.slice(i, i + 200);
      const { error } = await supabase.from("games").upsert(batch, { onConflict: "game_id" });
      if (error) {
        console.error(`[SYNC-GAMES] Écriture refusée (lot ${i}) :`, error.message);
      } else {
        inserted += batch.length;
      }
    }

    revalidatePath("/calendrier");
    revalidatePath("/");
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC-GAMES] ${inserted} matchs écrits en ${duration}s`);

    return NextResponse.json({
      ok: inserted === games.length,
      ...(inserted !== games.length && { error: `${games.length - inserted} matchs non écrits` }),
      source: "espn",
      season,
      totalGames: games.length,
      inserted,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // ESPN refuse ou reste muet : ce n'est pas une panne de la route. Rien
    // n'est écrit — les données déjà en base valent mieux qu'un écrasement.
    if (isUpstreamUnavailable(err)) {
      console.warn(`[SYNC-GAMES] ${err.source} indisponible (${err.message}) — calendrier inchangé`);
      return NextResponse.json({
        ok: true,
        skipped: `${err.source} indisponible`,
        reason: err.message,
        timestamp: new Date().toISOString(),
      });
    }
    console.error("[SYNC-GAMES] Erreur :", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
