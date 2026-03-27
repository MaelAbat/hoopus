"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import GlobalPipPlayer from "./GlobalPipPlayer";
import { VideoProvider } from "@/context/VideoContext";

export default function LayoutShell({
  children,
  ticker,
}: {
  children: React.ReactNode;
  ticker?: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/auth");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <VideoProvider>
      <Sidebar />
      <main className="min-h-screen pt-14 px-3 pb-4 sm:px-6 sm:pb-6 lg:ml-64 lg:pt-0 lg:p-8">
        {ticker && (
          <div className="sticky top-14 lg:top-0 z-30 mb-2">
            {ticker}
          </div>
        )}
        {children}
      </main>
      <GlobalPipPlayer />
    </VideoProvider>
  );
}
