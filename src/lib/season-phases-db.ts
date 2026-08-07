import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { estimateSeasonPhases, type PhaseKey, type SeasonPhase } from "./season-phases";

/**
 * Lecture des périodes d'une saison, pour les composants serveur.
 *
 * Les dates saisies à la main dans `season_phases` font foi ; les repères
 * manquants sont estimés à la volée, exactement comme le fait la synchronisation.
 * Une page n'a donc jamais de frise vide, même avant le premier passage du cron.
 *
 * Client sans cookies, comme pour l'état de saison : lire un calendrier ne doit
 * pas rendre dynamique la page qui le consulte.
 */

function readClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

async function loadSeasonPhases(season: string): Promise<SeasonPhase[]> {
  const estimated = estimateSeasonPhases(season);

  try {
    const { data, error } = await readClient()
      .from("season_phases")
      .select("season, phase, starts_on, ends_on, is_estimated")
      .eq("season", season);

    if (error || !data) return estimated;

    const stored: SeasonPhase[] = data.map((row) => ({
      season: row.season,
      phase: row.phase as PhaseKey,
      startsOn: row.starts_on,
      endsOn: row.ends_on ?? row.starts_on,
      isEstimated: row.is_estimated,
    }));

    const known = new Set(stored.map((p) => p.phase));
    return [...stored, ...estimated.filter((p) => !known.has(p.phase))];
  } catch {
    return estimated;
  }
}

/** Périodes d'une saison, mémoïsées pour la durée du rendu. */
export const getSeasonPhases = cache(loadSeasonPhases);
