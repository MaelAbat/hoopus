/**
 * Accès en lecture à l'état de saison de la ligue (`league_state`).
 *
 * Trois saisons, parce qu'elles ne basculent pas au même moment :
 *
 *   currentSeason   Saison dans laquelle la ligue se trouve — bascule dès la
 *                   fin des Finales. À utiliser pour les effectifs, les
 *                   salaires et les échanges : c'est là qu'atterrissent les
 *                   mouvements de l'intersaison.
 *   statsSeason     Dernière saison avec des matchs joués. À utiliser pour les
 *                   statistiques, le classement, les playoffs et les mini-jeux,
 *                   qui seraient vides de juin à octobre sinon.
 *   scheduleSeason  Dernière saison avec des matchs programmés. À utiliser pour
 *                   le calendrier, afin d'afficher le nouveau programme dès sa
 *                   publication.
 *
 * La table est écrite par `/api/sync-season`, qui tourne en tête du cron.
 */

import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { getCurrentSeason } from "./season";

export interface LeagueState {
  currentSeason: string;
  statsSeason: string;
  scheduleSeason: string;
  lastCompletedSeason: string | null;
  finalsChampion: string | null;
  /**
   * Vrai entre deux saisons : la ligue a basculé mais aucun match n'a encore été
   * joué. C'est la condition qui déclenche les repères d'intersaison à l'écran.
   */
  isOffseason: boolean;
}

/**
 * Client sans cookies : lire la saison ne doit pas rendre chaque page dynamique
 * (même approche que le sitemap).
 */
function readClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

/**
 * État de saison, mémoïsé pour la durée du rendu : une seule requête même si
 * plusieurs composants la demandent.
 *
 * Repli sur la règle calendaire si la table est absente ou injoignable — le
 * site reste debout, avec le comportement d'avant la migration 040.
 */
async function loadLeagueState(): Promise<LeagueState> {
  const fallbackSeason = getCurrentSeason();
  const fallback: LeagueState = {
    currentSeason: fallbackSeason,
    statsSeason: fallbackSeason,
    scheduleSeason: fallbackSeason,
    lastCompletedSeason: null,
    finalsChampion: null,
    isOffseason: false,
  };

  try {
    const supabase = readClient();
    const { data, error } = await supabase
      .from("league_state")
      .select("current_season, stats_season, schedule_season, last_completed_season, finals_champion")
      .limit(1)
      .maybeSingle();

    if (error || !data) return fallback;

    const currentSeason = data.current_season || fallbackSeason;
    const statsSeason = data.stats_season || currentSeason;

    return {
      currentSeason,
      statsSeason,
      scheduleSeason: data.schedule_season || currentSeason,
      lastCompletedSeason: data.last_completed_season ?? null,
      finalsChampion: data.finals_champion ?? null,
      isOffseason: currentSeason !== statsSeason,
    };
  } catch {
    return fallback;
  }
}

/**
 * État de saison mémoïsé — à utiliser depuis les pages et composants serveur.
 * Une seule requête par rendu, même si plusieurs composants la demandent.
 */
export const getLeagueState = cache(loadLeagueState);

/**
 * Variante non mémoïsée, pour les routes de synchronisation : elles tournent
 * hors du cycle de rendu React et doivent lire l'état frais à chaque appel.
 */
export const fetchLeagueState = loadLeagueState;

/** Saison de la ligue — effectifs, salaires, échanges. */
export async function getLeagueSeason(): Promise<string> {
  return (await getLeagueState()).currentSeason;
}

/** Dernière saison avec des matchs joués — statistiques, classement, jeux. */
export async function getStatsSeason(): Promise<string> {
  return (await getLeagueState()).statsSeason;
}

/** Dernière saison avec des matchs programmés — calendrier. */
export async function getScheduleSeason(): Promise<string> {
  return (await getLeagueState()).scheduleSeason;
}
