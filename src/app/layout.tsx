import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import AchievementProvider from "@/components/AchievementProvider";
import LayoutShell from "@/components/LayoutShell";
import ScoresTickerServer from "@/components/ScoresTickerServer";
import { hasNews } from "@/lib/actions/news";
import { hasArticles } from "@/lib/actions/articles";
import JsonLd from "@/components/JsonLd";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoopus.fr";

const description =
  "L'app NBA en français : scores en direct, calendrier, classements, statistiques des joueurs et des équipes, actualités, articles et mini-jeux. Suivez toute la saison NBA sur Hoopus.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Hoopus — Toute la NBA en français : scores, stats et actualités",
    template: "%s · Hoopus",
  },
  description,
  applicationName: "Hoopus",
  authors: [{ name: "Hoopus" }],
  creator: "Hoopus",
  publisher: "Hoopus",
  category: "sports",
  keywords: [
    "NBA",
    "basketball",
    "NBA en français",
    "scores NBA",
    "résultats NBA",
    "classement NBA",
    "statistiques NBA",
    "calendrier NBA",
    "joueurs NBA",
    "actualités NBA",
    "playoffs NBA",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Hoopus — Toute la NBA en français",
    description,
    url: siteUrl,
    siteName: "Hoopus",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hoopus — Toute la NBA en français",
    description,
  },
  verification: {
    google: "DQ7e55sjkF0cJA7MyEYfFSaXdOXJW-AsL2z1wuUc6W8",
  },
};

const siteJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Hoopus",
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    description: "Le compagnon NBA en français : scores, stats, classements et actualités.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Hoopus",
    url: siteUrl,
    inLanguage: "fr-FR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/joueurs?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [newsExists, articlesExist] = await Promise.all([hasNews(), hasArticles()]);

  return (
    <html lang="fr" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Default chrome color; updated per-theme by the script below and at runtime by ThemeProvider. */}
        <meta name="theme-color" content="#0c1222" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("theme")||(window.innerWidth>=1024?"dark":"light");document.documentElement.setAttribute("data-theme",t);var c={dark:"#0c1222",light:"#ffffff",midnight:"#0e0c20",emerald:"#091e14",sakura:"#1e0c14",ocean:"#081420"}[t]||"#0c1222";var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m)}m.setAttribute("content",c)}catch(e){}})()` }} />
        <JsonLd data={siteJsonLd} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AchievementProvider>
            <LayoutShell
              hasNews={newsExists}
              hasArticles={articlesExist}
              ticker={
                <Suspense fallback={null}>
                  <ScoresTickerServer />
                </Suspense>
              }
            >
              {children}
            </LayoutShell>
          </AchievementProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
