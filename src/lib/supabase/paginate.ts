/**
 * Lecture complète d'une table, par pages.
 *
 * PostgREST plafonne chaque réponse à mille lignes, indépendamment du `.limit()`
 * demandé. Une requête qui dépasse ce seuil est donc tronquée sans erreur ni
 * avertissement : les compteurs d'une page se calculent alors sur un échantillon
 * en se présentant comme un total. C'est exactement ce qui masquait les échanges
 * de la trade deadline dans la rubrique Mercato.
 *
 * `maxRows` borne le rapatriement, et l'atteindre est signalé dans les journaux :
 * une troncature silencieuse se lit comme une donnée complète, jamais l'inverse.
 */

const PAGE_SIZE = 1000;

export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  { label = "requête", maxRows = 20_000 }: { label?: string; maxRows?: number } = {}
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await page(from, Math.min(from + PAGE_SIZE, maxRows) - 1);
    if (error) {
      console.error(`[PAGINATE] ${label} : ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }

  if (rows.length >= maxRows) {
    console.warn(`[PAGINATE] ${label} : plafond de ${maxRows} lignes atteint, lecture tronquée`);
  }

  return rows;
}
