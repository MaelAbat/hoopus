import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hoopus — Votre olympe du basketball",
    short_name: "Hoopus",
    description:
      "L'app NBA en français : scores en direct, calendrier, classements, statistiques, actualités et mini-jeux.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#f97316",
    lang: "fr",
    categories: ["sports", "news"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
