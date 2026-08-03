/**
 * Lecture des seuils de masse salariale (`salary_cap_levels`).
 *
 * La table est la source de vérité ; les montants codés dans
 * `salary-cap.ts` ne servent que d'amorce et de dernier recours si la table est
 * absente ou injoignable.
 *
 * Une saison sans montants annoncés reçoit une projection marquée « estimée »,
 * que l'interface signale. C'est ce qui permet à une nouvelle saison de
 * fonctionner sans intervention : /api/sync-season insère la projection, et
 * corriger le montant réel se fait par un UPDATE d'une ligne.
 */

import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import {
  KNOWN_THRESHOLDS,
  resolveThresholds,
  type CapThresholds,
  type SeasonThresholds,
} from "./salary-cap";

/** Client sans cookies — lire les seuils ne doit pas rendre la page dynamique. */
function readClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

interface CapLevelRow {
  season: string;
  salary_cap: number;
  luxury_tax: number;
  first_apron: number;
  second_apron: number;
  is_estimated: boolean;
}

async function loadAllLevels(): Promise<CapLevelRow[]> {
  try {
    const supabase = readClient();
    const { data, error } = await supabase
      .from("salary_cap_levels")
      .select("season, salary_cap, luxury_tax, first_apron, second_apron, is_estimated");
    if (error || !data) return [];
    return data as CapLevelRow[];
  } catch {
    return [];
  }
}

/** Toutes les lignes de seuils, mémoïsées pour la durée du rendu. */
const getAllLevels = cache(loadAllLevels);

/**
 * Seuils de la saison demandée.
 *
 * Ordre : la ligne exacte en base, puis une projection depuis les montants
 * connus (base ou code). Jamais les seuils d'une autre saison présentés comme
 * ceux de celle-ci.
 */
export async function getCapLevels(season: string): Promise<SeasonThresholds> {
  const rows = await getAllLevels();

  const exact = rows.find((r) => r.season === season);
  if (exact) {
    return {
      season,
      salaryCap: exact.salary_cap,
      luxuryTax: exact.luxury_tax,
      firstApron: exact.first_apron,
      secondApron: exact.second_apron,
      isEstimated: exact.is_estimated,
    };
  }

  // Pas de ligne : on projette depuis ce que l'on connaît, base d'abord.
  const known: Record<string, CapThresholds> = { ...KNOWN_THRESHOLDS };
  for (const r of rows) {
    if (r.is_estimated) continue; // ne pas projeter depuis une projection
    known[r.season] = {
      salaryCap: r.salary_cap,
      luxuryTax: r.luxury_tax,
      firstApron: r.first_apron,
      secondApron: r.second_apron,
    };
  }

  return resolveThresholds(season, known);
}
