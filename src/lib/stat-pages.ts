/**
 * Instantanés de la page /statistiques.
 *
 * La page a besoin de toutes les lignes de leaders d'une saison — ~22 000 —
 * pour ses classements et son tableau complet. Les relire dans stat_leaders
 * coûtait vingt-deux requêtes, et un tri, à chaque fois que son cache se
 * vidait. sync-stats, qui a déjà toutes ces lignes en main, en écrit donc une
 * copie compacte dans `stat_pages` : une ligne par saison et type, lue en une
 * seule requête.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface LeaderLine {
  category: string;
  rank: number;
  player_name: string;
  player_id: number | null;
  team: string;
  value: number;
  updated_at: string;
}

/** [category, rank, player_name, player_id, team, value] : deux fois plus court qu'un objet. */
type PackedLine = [string, number, string, number | null, string, number];

export interface StatPagePayload {
  updated_at: string;
  rows: PackedLine[];
}

/**
 * Lignes rangées comme la page les lisait dans stat_leaders : rang, catégorie,
 * joueur. Elle en dépend — le top 10 d'une catégorie, ce sont ses dix premières.
 */
export function packStatPage(
  rows: Omit<LeaderLine, "updated_at">[],
  updatedAt: string
): StatPagePayload {
  const sorted = [...rows].sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.category < b.category ? -1 : a.category > b.category ? 1 : 0) ||
      (a.player_name < b.player_name ? -1 : a.player_name > b.player_name ? 1 : 0)
  );
  return {
    updated_at: updatedAt,
    rows: sorted.map((r) => [r.category, r.rank, r.player_name, r.player_id, r.team, Number(r.value)]),
  };
}

export function unpackStatPage(payload: StatPagePayload): LeaderLine[] {
  return payload.rows.map(([category, rank, player_name, player_id, team, value]) => ({
    category,
    rank,
    player_name,
    player_id,
    team,
    value,
    updated_at: payload.updated_at,
  }));
}

/** Instantané d'une saison, ou `null` s'il n'existe pas encore. */
export async function readStatPage(
  supabase: SupabaseClient,
  season: string,
  seasonType: "regular" | "playoffs"
): Promise<LeaderLine[] | null> {
  const { data, error } = await supabase
    .from("stat_pages")
    .select("payload")
    .eq("season", season)
    .eq("season_type", seasonType)
    .maybeSingle();
  if (error || !data?.payload) return null;
  return unpackStatPage(data.payload as StatPagePayload);
}
