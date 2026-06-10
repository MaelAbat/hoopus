import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import AchievementProvider from "@/components/AchievementProvider";
import LayoutShell from "@/components/LayoutShell";
import ScoresTickerServer from "@/components/ScoresTickerServer";
import { hasNews } from "@/lib/actions/news";
import { hasArticles } from "@/lib/actions/articles";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoopus.fr";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Hoopus",
  description: "Votre olympe du basketball — actualités, articles, statistiques",
  openGraph: {
    title: "Hoopus",
    description: "Votre olympe du basketball — actualités, articles, statistiques",
    siteName: "Hoopus",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hoopus",
    description: "Votre olympe du basketball — actualités, articles, statistiques",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [newsExists, articlesExist] = await Promise.all([hasNews(), hasArticles()]);

  return (
    <html lang="fr" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("theme");if(t){document.documentElement.setAttribute("data-theme",t)}else{document.documentElement.setAttribute("data-theme",window.innerWidth>=1024?"dark":"light")}}catch(e){}})()` }} />
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
