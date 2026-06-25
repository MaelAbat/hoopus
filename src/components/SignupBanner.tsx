"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { UserPlus } from "lucide-react";

/**
 * Banner shown to anonymous users after score submission,
 * encouraging them to create an account to keep their data.
 */
export default function SignupBanner({ show }: { show: boolean }) {
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!show) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.is_anonymous) {
        setIsAnonymous(true);
        const stored = localStorage.getItem("hoop-anonymous-name");
        if (stored) setDisplayName(stored);
      }
    });
  }, [show]);

  if (!show || !isAnonymous) return null;

  return (
    <div className="relative flex items-start gap-3 overflow-hidden border border-rule bg-card px-4 py-3.5 sm:px-5">
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
      <UserPlus size={16} className="mt-0.5 shrink-0 text-accent-text" />
      <div className="flex-1">
        <p className="text-sm text-text-muted">
          Tu joues en tant que{" "}
          <span className="font-semibold text-text-primary">{displayName}</span>. Crée un compte pour garder ton pseudo, tes scores et tes succès.
        </p>
        <Link
          href="/auth/signup"
          className="mt-3 inline-flex items-center bg-accent px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
        >
          Crée un compte
        </Link>
      </div>
    </div>
  );
}
