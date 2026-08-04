/**
 * Rubriques en chantier.
 *
 * Une rubrique encore en cours de réglage reste accessible en développement
 * mais n'existe pas pour le site public : lien absent du menu, page en 404,
 * URL retirée du sitemap. On la peaufine sans la montrer, et sans avoir à
 * défaire le code déjà en place.
 *
 * Ces drapeaux sont lus à la compilation (préfixe NEXT_PUBLIC_, donc lisibles
 * côté client) : après avoir changé `.env.local`, relancer `npm run dev`.
 * Pour publier la rubrique, poser la variable sur Vercel — ou supprimer le
 * drapeau et les gardes qui le consultent.
 */

/** Trade Machine (/trades) — moteur de règles CBA encore en rodage. */
export const TRADE_MACHINE_ENABLED = process.env.NEXT_PUBLIC_TRADE_MACHINE === "1";
