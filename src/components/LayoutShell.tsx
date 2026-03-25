"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

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
    <>
      <Sidebar />
      <main className="ml-64 min-h-screen p-8">
        {ticker && (
          <div className="sticky top-0 z-40 -mx-8 -mt-8 px-8 pt-8 pb-0 bg-bg/80 backdrop-blur-md">
            {ticker}
          </div>
        )}
        {children}
      </main>
    </>
  );
}
