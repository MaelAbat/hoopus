import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hoopus — Toute la NBA, en français",
    short_name: "Hoopus",
    description:
      "L'app NBA en français : scores en direct, calendrier, classements, statistiques, actualités et mini-jeux.",
    start_url: "/",
    display: "standalone",
    // Match the app's dark chrome so the PWA status bar / nav bar blend in
    // instead of showing an orange band. The live <meta name="theme-color">
    // (set by ThemeProvider) overrides this per active theme at runtime.
    background_color: "#090f1d",
    theme_color: "#0c1222",
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
