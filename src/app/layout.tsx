import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import LayoutShell from "@/components/LayoutShell";
import ScoresTickerServer from "@/components/ScoresTickerServer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoopus.fr";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Hoopus",
  description: "Votre olympe du basketball — actualites, articles, statistiques",
  openGraph: {
    title: "Hoopus",
    description: "Votre olympe du basketball — actualites, articles, statistiques",
    siteName: "Hoopus",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hoopus",
    description: "Votre olympe du basketball — actualites, articles, statistiques",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-theme="light">
      <body className="antialiased">
        <ThemeProvider>
          <LayoutShell
            ticker={
              <Suspense fallback={null}>
                <ScoresTickerServer />
              </Suspense>
            }
          >
            {children}
          </LayoutShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
