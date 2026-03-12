"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 rounded-xl bg-input border border-border-t px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-card-hover hover:text-text-primary"
    >
      <LogOut size={16} />
      Déconnexion
    </button>
  );
}
