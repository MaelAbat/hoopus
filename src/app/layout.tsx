import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import LayoutShell from "@/components/LayoutShell";
import ScoresTickerServer from "@/components/ScoresTickerServer";

export const metadata: Metadata = {
  title: "Hoopus",
  description: "Votre olympe du basketball — actualites, articles, statistiques",
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
