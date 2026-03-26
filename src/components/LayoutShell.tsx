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
      <main className="min-h-screen pt-14 px-3 pb-4 sm:px-6 sm:pb-6 lg:ml-64 lg:pt-0 lg:p-8 overflow-clip">
        {ticker && (
          <div className="mb-2">
            {ticker}
          </div>
        )}
        {children}
      </main>
    </>
  );
}
