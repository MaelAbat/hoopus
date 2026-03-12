"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Home,
  Newspaper,
  FileText,
  BarChart3,
  Calendar,
  User,
  Trophy,
  LogIn,
  LogOut,
  Shield,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: "/", label: "Accueil", icon: <Home size={20} /> },
  { href: "/actualites", label: "Actualités", icon: <Newspaper size={20} /> },
  { href: "/articles", label: "Articles", icon: <FileText size={20} /> },
  { href: "/statistiques", label: "Statistiques", icon: <BarChart3 size={20} /> },
  { href: "/calendrier", label: "Calendrier", icon: <Calendar size={20} /> },
  { href: "/profil", label: "Profil", icon: <User size={20} /> },
];

interface UserProfile {
  display_name: string;
  email: string;
  is_admin: boolean;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("display_name, email, is_admin")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    }

    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setProfile(null);
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar border-r border-border-t transition-colors duration-300">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover shadow-lg">
          <Trophy size={20} className="text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight text-text-primary">
          NBA<span className="text-accent">Hub</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-accent-light text-accent shadow-sm"
                  : "text-text-muted hover:bg-input hover:text-text-primary"
              }`}
            >
              <span
                className={`transition-colors duration-200 ${
                  isActive
                    ? "text-accent"
                    : "text-text-faint group-hover:text-text-primary"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border-t px-4 py-4">
        {loading ? (
          <div className="h-10 animate-pulse rounded-xl bg-input" />
        ) : profile ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-sm font-bold text-white">
                {profile.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {profile.display_name}
                </p>
                <div className="flex items-center gap-1">
                  {profile.is_admin ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-text">
                      <Shield size={10} />
                      Admin
                    </span>
                  ) : (
                    <span className="text-[10px] text-text-faint">Membre</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-input hover:text-text-primary"
            >
              <LogOut size={14} />
              Déconnexion
            </button>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-input hover:text-text-primary"
          >
            <LogIn size={16} />
            Se connecter
          </Link>
        )}
        <p className="mt-3 text-xs text-text-faint">© 2026 NBAHub</p>
      </div>
    </aside>
  );
}
