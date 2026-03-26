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
      <main className="min-h-screen pt-14 px-3 pb-4 sm:px-6 sm:pb-6 lg:ml-64 lg:pt-0 lg:p-8 overflow-x-hidden">
        {ticker && (
          <div className="sticky top-14 lg:top-0 z-40 -mx-3 -mt-14 px-3 pt-14 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8 bg-bg/80 backdrop-blur-md">
            {ticker}
          </div>
        )}
        {children}
      </main>
    </>
  );
}
