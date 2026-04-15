"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useTransition } from "react";
import Sidebar from "./Sidebar";
import GlobalPipPlayer from "./GlobalPipPlayer";
import ScrollButton from "./ScrollButton";
import CommandPalette from "./CommandPalette";
import { VideoProvider } from "@/context/VideoContext";
import { FavoritesProvider } from "@/context/FavoritesContext";

// Global navigation transition context
const NavTransitionCtx = createContext<{ isPending: boolean }>({ isPending: false });
export function useNavTransition() {
  return useContext(NavTransitionCtx);
}

export default function LayoutShell({
  children,
  ticker,
}: {
  children: React.ReactNode;
  ticker?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname.startsWith("/auth");
  const [isPending, startTransition] = useTransition();

  // Intercept internal link clicks in capture phase (before Next.js Link handler)
  const handleClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      // Skip if modifier keys (new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      // Skip download links or target="_blank"
      if (anchor.hasAttribute("download") || anchor.target === "_blank") return;
      // Skip if already on this page
      if (href === pathname) return;

      e.preventDefault();
      e.stopPropagation();
      startTransition(() => {
        router.push(href);
      });
    },
    [router, startTransition, pathname]
  );

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <NavTransitionCtx.Provider value={{ isPending }}>
      <FavoritesProvider>
        <VideoProvider>
          <div onClickCapture={handleClickCapture}>
            <Sidebar />
            <main className="min-h-screen pt-14 px-3 pb-4 sm:px-6 sm:pb-6 lg:ml-64 lg:pt-0 lg:p-8">
              {ticker && (
                <div className="sticky top-14 lg:top-0 z-30 mb-2 pt-3 lg:pt-4">
                  {ticker}
                </div>
              )}
              <div
                className="transition-all duration-300 ease-in-out"
                style={{
                  opacity: isPending ? 0.4 : 1,
                  filter: isPending ? "blur(4px)" : "none",
                  pointerEvents: isPending ? "none" : "auto",
                }}
              >
                {children}
              </div>
            </main>
            <ScrollButton />
            <CommandPalette />
            <GlobalPipPlayer />
          </div>
        </VideoProvider>
      </FavoritesProvider>
    </NavTransitionCtx.Provider>
  );
}
