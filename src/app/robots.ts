import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoopus.fr";

/**
 * Robots d'entraînement d'IA et outils SEO tiers : ils n'apportent aucun
 * visiteur, crawlent en masse, et chaque page qu'ils visitent hors cache se paie
 * en temps de calcul Vercel. Exclus du site entier.
 */
const BLOCKED_BOTS = [
  "GPTBot",
  "CCBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "meta-externalagent",
  "FacebookBot",
  "Amazonbot",
  "PerplexityBot",
  "cohere-ai",
  "Diffbot",
  "ImagesiftBot",
  "Timpibot",
  "omgili",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "PetalBot",
  "DataForSeoBot",
  "BLEXBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/profil",
          "/mini-jeux/hoopiz/create",
          // Chaque fiche joueur lie un comparateur pré-rempli : cinq mille URLs
          // rendues à la demande, sans contenu propre à indexer.
          "/joueurs/comparer?",
          // Les saisons passées multiplient chaque rubrique par le nombre de
          // saisons archivées ; la saison courante, sans paramètre, suffit.
          "/*?*season=",
        ],
      },
      { userAgent: BLOCKED_BOTS, disallow: "/" },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
