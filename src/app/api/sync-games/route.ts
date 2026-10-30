import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { fetchLeagueState } from "@/lib/league-season";
import { isCronAuthorized } from "@/lib/cron-auth";
import { isUpstreamUnavailable } from "@/lib/upstream";
import { fetchSeasonGames, type GameRow } from "@/lib/espn-schedule";
import { loadExisting, upsertChanged } from "@/lib/write-changed";

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

    // Seuls les matchs nouveaux ou modifiés partent : d'un jour à l'autre, une
    // dizaine de scores changent sur 1 200 matchs.
    const COMPARE = [
      "game_date", "game_time", "status", "status_text", "home_team", "home_team_name", "home_score",
      "away_team", "away_team_name", "away_score", "arena", "arena_city", "season", "source",
      "game_type", "playoff_round",
    ] as const;
    const existing = await loadExisting(supabase, "games", COMPARE, ["game_id"], {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filter: (q: any) => q.eq("season", season),
      order: ["game_id"],
    });
    const { written, unchanged, failed } = await upsertChanged(supabase, "games", games, {
      existing,
      key: ["game_id"],
      compare: COMPARE,
      onConflict: "game_id",
    });
    const inserted = written + unchanged;
    console.log(`[SYNC-GAMES] ${written} écrit(s), ${unchanged} inchangé(s)${failed ? `, ${failed} refusé(s)` : ""}`);

    revalidatePath("/calendrier");
    revalidatePath("/");
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC-GAMES] ${inserted} matchs à jour en ${duration}s`);

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
