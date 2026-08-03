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

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { fetchLeagueSchedule, readSeasonYear } from "@/lib/nba-schedule";
import { fetchCapHistory } from "@/lib/br-cap-history";
import { isCronAuthorized } from "@/lib/cron-auth";
import {
  FIRST_APRON_SEASON_START_YEAR,
  KNOWN_THRESHOLDS,
  resolveThresholds,
  thresholdsFromCap,
  type CapThresholds,
} from "@/lib/salary-cap";
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

/**
 * `seasonYear` tel que le CDN l'annonce, ou `null` s'il est injoignable.
 *
 * Volontairement sans repli sur stats.nba.com : ce repli exige de nommer une
 * saison, or c'est précisément ce qu'on cherche à déterminer. Le signal serait
 * circulaire. Les Finales en base restent la règle principale — le CDN ne fait
 * que confirmer.
 */
async function fetchScheduleSeasonYear(): Promise<string | null> {
  try {
    const schedule = await fetchLeagueSchedule({ attempts: 2 });
    return readSeasonYear(schedule);
  } catch (err) {
    console.error("[SYNC-SEASON] Signal CDN indisponible:", (err as Error).message);
    return null;
  }
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
      // Dernière saison avec au moins un match de saison régulière terminé.
      // Le préfixe 002 exclut la présaison : un match amical joué début octobre
      // ferait sinon basculer les pages de statistiques sur une saison encore
      // dépourvue de données.
      supabase.from("games").select("season").eq("status", 3).like("game_id", "002%"),
      // Dernière saison avec au moins un match de saison régulière programmé.
      supabase.from("games").select("season").like("game_id", "002%"),
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

    // ── Seuils de masse salariale ──
    // Le plafond vient de Basketball Reference, qui le publie saison à venir
    // comprise ; les trois autres seuils s'en déduisent par les rapports fixes de
    // la convention. Ce n'est donc pas une estimation, contrairement à la
    // projection à +10 % qui servait avant et qui surestimait 2026-27 de 5,2 M$.
    //
    // Les lignes déjà marquées comme officielles ne sont jamais touchées : une
    // valeur saisie à la main reste prioritaire sur un calcul.
    const capLevelsWritten: string[] = [];
    const { data: existingLevels } = await supabase
      .from("salary_cap_levels")
      .select("season, salary_cap, luxury_tax, first_apron, second_apron, is_estimated");

    const official = new Set(
      (existingLevels || []).filter((r) => !r.is_estimated).map((r) => r.season)
    );

    const capHistory = await fetchCapHistory();
    for (const [season, cap] of capHistory) {
      // Avant la convention 2023, il n'y avait pas de second apron : en déduire
      // un n'aurait aucun sens.
      if (seasonStartYear(season) < FIRST_APRON_SEASON_START_YEAR) continue;
      if (official.has(season)) continue;

      const derived = thresholdsFromCap(cap);
      const { error: levelsError } = await supabase.from("salary_cap_levels").upsert(
        {
          season,
          salary_cap: derived.salaryCap,
          luxury_tax: derived.luxuryTax,
          first_apron: derived.firstApron,
          second_apron: derived.secondApron,
          // Le plafond est officiel, les aprons en découlent par calcul.
          is_estimated: false,
          updated_at: now,
        },
        { onConflict: "season" }
      );
      if (levelsError) {
        console.error(`[SYNC-SEASON] Seuils ${season} non écrits:`, levelsError.message);
      } else {
        capLevelsWritten.push(season);
      }
    }

    // Aucun plafond publié pour la saison courante : on retombe sur la
    // projection, cette fois explicitement marquée comme estimée.
    if (!capHistory.has(currentSeason) && !official.has(currentSeason)) {
      const known: Record<string, CapThresholds> = { ...KNOWN_THRESHOLDS };
      for (const [season, cap] of capHistory) known[season] = thresholdsFromCap(cap);

      const projected = resolveThresholds(currentSeason, known);
      if (projected.salaryCap > 0) {
        await supabase.from("salary_cap_levels").upsert(
          {
            season: currentSeason,
            salary_cap: projected.salaryCap,
            luxury_tax: projected.luxuryTax,
            first_apron: projected.firstApron,
            second_apron: projected.secondApron,
            is_estimated: true,
            updated_at: now,
          },
          { onConflict: "season" }
        );
        capLevelsWritten.push(`${currentSeason} (projeté)`);
      }
    }

    const capLevels = capLevelsWritten.length > 0 ? capLevelsWritten.join(", ") : null;
    if (capLevels) console.log(`[SYNC-SEASON] Seuils écrits : ${capLevels}`);

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
      capLevels,
      timestamp: now,
    });
  } catch (err) {
    console.error("[SYNC-SEASON] Failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
