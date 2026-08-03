/**
 * Bascule automatique de saison.
 *
 * Tourne en tête du cron, avant toute autre synchronisation, pour que tous les
 * autres endpoints écrivent dans la bonne saison.
 *
 * Trois signaux, du plus fiable au moins fiable :
 *
 *   1. Les Finales en base — `playoff_series` round 4 avec 4 victoires. C'est
 *      la règle métier : dès que le dernier match des Finales est joué, la
 *      ligue est dans la saison suivante.
 *   2. `leagueSchedule.seasonYear` du CDN NBA, qui bascule de lui-même à
 *      l'intersaison.
 *   3. La règle calendaire, comme borne de sécurité.
 *
 * Nettoie aussi les matchs jamais joués d'une saison terminée : les rencontres
 * « if necessary » d'une série qui s'arrête avant le game 7 restent sinon en
 * base au statut « programmé », et le CDN ne les sert plus une fois la saison
 * finie — personne ne peut donc plus les corriger.
 */

import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import {
  getCurrentSeason,
  latestSeason,
  resolveLeagueSeason,
  seasonStartYear,
} from "@/lib/season";

/** Pages dont le contenu dépend de la saison affichée. */
const REVALIDATED_PATHS = [
  "/",
  "/calendrier",
  "/classement",
  "/statistiques",
  "/playoffs",
  "/equipes",
  "/trades",
  "/blessures",
  "/joueurs",
  "/mini-jeux",
];

function fetchScheduleSeasonYear(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(
      "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "*/*",
          "Accept-Encoding": "identity",
          Referer: "https://www.nba.com/",
          Origin: "https://www.nba.com",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            console.error(`[SYNC-SEASON] CDN status ${res.statusCode}`);
            resolve(null);
            return;
          }
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
            const year = json?.leagueSchedule?.seasonYear;
            resolve(typeof year === "string" && /^\d{4}-\d{2}$/.test(year) ? year : null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    // Signal non essentiel : en cas d'échec on se rabat sur les Finales.
    req.on("error", (err) => {
      console.error("[SYNC-SEASON] CDN fetch failed:", err.message);
      resolve(null);
    });
    req.setTimeout(30000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

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
    const calendarSeason = getCurrentSeason();

    const [scheduleSeasonYear, finalsRows, playedRows, scheduledRows] = await Promise.all([
      fetchScheduleSeasonYear(),
      supabase
        .from("playoff_series")
        .select("season, team_top, team_bottom, wins_top, wins_bottom")
        .eq("round", 4),
      // Dernière saison avec au moins un match terminé.
      supabase.from("games").select("season").eq("status", 3),
      // Dernière saison avec au moins un match programmé.
      supabase.from("games").select("season"),
    ]);

    // ── Finales décidées ──
    const decidedFinals = (finalsRows.data || []).filter(
      (s) => Math.max(s.wins_top ?? 0, s.wins_bottom ?? 0) >= 4
    );
    const lastFinals = decidedFinals.reduce<(typeof decidedFinals)[number] | null>(
      (best, s) => (!best || seasonStartYear(s.season) > seasonStartYear(best.season) ? s : best),
      null
    );
    const finalsCompletedSeason = lastFinals?.season ?? null;
    const finalsChampion = lastFinals
      ? (lastFinals.wins_top ?? 0) >= 4
        ? lastFinals.team_top
        : lastFinals.team_bottom
      : null;

    // ── Saison de la ligue ──
    const currentSeason = resolveLeagueSeason({
      calendarSeason,
      scheduleSeason: scheduleSeasonYear,
      finalsCompletedSeason,
    });

    // ── Saisons d'affichage ──
    const statsSeason =
      latestSeason(...(playedRows.data || []).map((r) => r.season)) ?? currentSeason;
    const scheduleSeason =
      latestSeason(...(scheduledRows.data || []).map((r) => r.season)) ?? statsSeason;

    const now = new Date().toISOString();

    const { error: upsertError } = await supabase.from("league_state").upsert(
      {
        id: true,
        current_season: currentSeason,
        stats_season: statsSeason,
        schedule_season: scheduleSeason,
        last_completed_season: finalsCompletedSeason,
        finals_champion: finalsChampion,
        updated_at: now,
      },
      { onConflict: "id" }
    );
    if (upsertError) throw new Error(`league_state upsert failed: ${upsertError.message}`);

    // ── Nettoyage des matchs jamais joués d'une saison terminée ──
    // Une saison dont les Finales sont jouées ne peut plus contenir de match
    // « programmé » : ce sont les games 6/7 rendus inutiles par un sweep.
    let phantomsRemoved = 0;
    if (finalsCompletedSeason) {
      const { data: removed, error: cleanupError } = await supabase
        .from("games")
        .delete()
        .eq("season", finalsCompletedSeason)
        .neq("status", 3)
        .select("game_id");
      if (cleanupError) {
        console.error("[SYNC-SEASON] Phantom cleanup failed:", cleanupError.message);
      } else {
        phantomsRemoved = removed?.length ?? 0;
      }
    }

    for (const path of REVALIDATED_PATHS) revalidatePath(path);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[SYNC-SEASON] current=${currentSeason} stats=${statsSeason} schedule=${scheduleSeason} ` +
        `(calendrier=${calendarSeason}, cdn=${scheduleSeasonYear ?? "n/a"}, finales=${finalsCompletedSeason ?? "n/a"}) ` +
        `fantômes supprimés=${phantomsRemoved} en ${duration}s`
    );

    return NextResponse.json({
      ok: true,
      currentSeason,
      statsSeason,
      scheduleSeason,
      lastCompletedSeason: finalsCompletedSeason,
      finalsChampion,
      signals: {
        calendarSeason,
        scheduleSeasonYear,
        finalsCompletedSeason,
      },
      phantomsRemoved,
      timestamp: now,
    });
  } catch (err) {
    console.error("[SYNC-SEASON] Failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
