import { createServerClient } from "@supabase/ssr";

/**
 * Client de lecture publique, sans cookies.
 *
 * Le client de `./server` lit `cookies()`, et une seule lecture de cookies suffit
 * à rendre toute la route dynamique : `revalidate` est alors ignoré, chaque visite
 * refait le rendu et toutes ses requêtes. Comme le gabarit racine lisait les
 * actualités par ce client, aucune page du site n'était mise en cache.
 *
 * Tout ce qui est public — et ne dépend donc pas du visiteur — passe par ici.
 * Le client de `./server` reste réservé à ce qui lit la session : profil,
 * administration, scores personnels.
 *
 * `revalidate` (en secondes) met les réponses en cache côté Next. C'est utile aux
 * pages qui restent dynamiques parce qu'elles lisent `searchParams` : le rendu se
 * refait, mais sans aller-retour vers Supabase tant que le cache est frais. Les
 * `revalidatePath` des syncs vident ce cache avec la page.
 */
export function createPublicClient({ revalidate }: { revalidate?: number } = {}) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      ...(revalidate !== undefined && {
        global: {
          fetch: (input: RequestInfo | URL, init?: RequestInit) =>
            fetch(input, { ...init, next: { revalidate } }),
        },
      }),
    }
  );
}
