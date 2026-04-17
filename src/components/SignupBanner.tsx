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
    <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
      <UserPlus size={16} className="mt-0.5 shrink-0 text-accent-text" />
      <p className="text-sm text-text-muted">
        Tu joues en tant que{" "}
        <span className="font-medium italic text-text-primary">{displayName}</span>.{" "}
        <Link
          href="/auth/signup"
          className="font-semibold text-accent hover:text-accent-hover transition-colors underline underline-offset-2"
        >
          Crée un compte
        </Link>{" "}
        pour garder ton pseudo, tes scores et tes succès.
      </p>
    </div>
  );
}
