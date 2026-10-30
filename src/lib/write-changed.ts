/**
 * N'écrire en base que ce qui a changé.
 *
 * Les syncs réécrivaient chaque jour toutes leurs lignes, identiques ou non :
 * 21 890 lignes de statistiques, 1 200 matchs, 5 000 mouvements… Sur l'offre
 * gratuite de Supabase, chaque réécriture coûte la ligne, ses index et le
 * journal de transactions, et le budget d'accès disque s'épuisait. Les lignes
 * calculées sont donc comparées à celles en base, et seules les nouvelles ou
 * les modifiées partent.
 *
 * `updated_at` n'est pas comparé : une ligne inchangée garde la date de sa
 * dernière modification réelle.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

/** Égalité tolérante aux formes que renvoie PostgREST (numeric en nombre ou en chaîne, jsonb en objet). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === "number" || typeof b === "number") {
    const x = Number(a);
    const y = Number(b);
    if (Number.isFinite(x) && Number.isFinite(y)) return Math.abs(x - y) < 1e-9;
  }
  if (typeof a === "object" || typeof b === "object") return JSON.stringify(a) === JSON.stringify(b);
  return String(a) === String(b);
}

export function keyOf(row: object, key: readonly string[]): string {
  return key.map((k) => String((row as Row)[k] ?? "")).join("|");
}

/** Lignes de `rows` absentes de `existing` ou qui en diffèrent sur l'une des colonnes `compare`. */
export function changedRows<T extends object>(
  rows: T[],
  existing: Map<string, Row>,
  key: readonly string[],
  compare: readonly string[]
): T[] {
  return rows.filter((row) => {
    const current = existing.get(keyOf(row, key));
    return !current || compare.some((c) => !same((row as Row)[c], current[c]));
  });
}

/**
 * Lit les lignes existantes d'une table, page par page, indexées par `key`.
 * `filter` restreint la lecture (la saison, typiquement) ; `order` doit
 * désigner une clé unique pour que la pagination ne saute ni ne double rien.
 */
export async function loadExisting(
  supabase: SupabaseClient,
  table: string,
  columns: readonly string[],
  key: readonly string[],
  {
    filter,
    order,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter?: (q: any) => any;
    order: readonly string[];
  }
): Promise<Map<string, Row>> {
  const existing = new Map<string, Row>();
  const select = [...new Set([...key, ...columns])].join(", ");
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(select);
    if (filter) q = filter(q);
    for (const o of order) q = q.order(o, { ascending: true });
    const { data, error } = await q.range(from, from + 999);
    if (error) throw new Error(`lecture de ${table} impossible : ${error.message}`);
    for (const r of (data ?? []) as unknown as Row[]) existing.set(keyOf(r, key), r);
    if (!data || data.length < 1000) break;
  }
  return existing;
}

/**
 * Upsert des seules lignes nouvelles ou modifiées. Renvoie le nombre de lignes
 * écrites et de lignes laissées telles quelles.
 */
export async function upsertChanged<T extends object>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  {
    existing,
    key,
    compare,
    onConflict,
    batchSize = 500,
  }: {
    existing: Map<string, Row>;
    key: readonly string[];
    compare: readonly string[];
    onConflict: string;
    batchSize?: number;
  }
): Promise<{ written: number; unchanged: number; failed: number }> {
  const changed = changedRows(rows, existing, key, compare);
  let written = 0;
  let failed = 0;
  for (let i = 0; i < changed.length; i += batchSize) {
    const batch = changed.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      console.error(`[WRITE-CHANGED] ${table} : écriture refusée (lot ${i}) — ${error.message}`);
      failed += batch.length;
    } else {
      written += batch.length;
      // La base reflète désormais ces lignes : un second appel dans la même
      // exécution ne les réécrira pas.
      for (const r of batch) existing.set(keyOf(r, key), r as Row);
    }
  }
  return { written, unchanged: rows.length - changed.length, failed };
}
