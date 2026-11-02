"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Utilisateur de la session du navigateur, lu localement.
 *
 * `auth.getUser()` interroge Supabase Auth à chaque appel pour revalider le
 * jeton, et la barre latérale, le thème, les favoris et la bannière
 * l'appelaient chacun à chaque page ouverte. Côté navigateur, ces composants
 * n'ont besoin que de savoir qui est connecté : la session locale suffit, et
 * les données restent protégées par les règles RLS, qui vérifient le jeton.
 * Le client la rafraîchit lui-même quand elle expire.
 */
export async function getSessionUser(supabase: ReturnType<typeof createClient>) {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}
