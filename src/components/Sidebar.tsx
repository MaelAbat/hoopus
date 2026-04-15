"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Home,
  Newspaper,
  FileText,
  BarChart3,
  Calendar,
  User,
  UserRound,
  Trophy,
  Users,
  Gamepad2,
  LogIn,
  LogOut,
  Shield,
  Menu,
  X,
  Palette,
  HeartPulse,
  Search,
} from "lucide-react";
import SyncButton from "./SyncButton";
import { useTheme } from "./ThemeProvider";
import { useFavorites } from "@/context/FavoritesContext";
import { teamLogoUrl } from "@/lib/nba-teams";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const S = 18;
const SW = 1.5;

const navItems: NavItem[] = [
  { href: "/", label: "Accueil", icon: <Home size={S} strokeWidth={SW} /> },
  { href: "/actualites", label: "Actualités", icon: <Newspaper size={S} strokeWidth={SW} /> },
  { href: "/articles", label: "Articles", icon: <FileText size={S} strokeWidth={SW} /> },
  { href: "/statistiques", label: "Statistiques", icon: <BarChart3 size={S} strokeWidth={SW} /> },
  { href: "/calendrier", label: "Calendrier", icon: <Calendar size={S} strokeWidth={SW} /> },
  { href: "/classement", label: "Classement", icon: (
    <svg width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="10" width="6" height="11" rx="1" />
      <rect x="9" y="4" width="6" height="17" rx="1" />
      <rect x="16" y="14" width="6" height="7" rx="1" />
    </svg>
  ) },
  { href: "/equipes", label: "Équipes", icon: <Users size={S} strokeWidth={SW} /> },
  { href: "/joueurs", label: "Joueurs", icon: <UserRound size={S} strokeWidth={SW} /> },
  { href: "/blessures", label: "Infirmerie", icon: <HeartPulse size={S} strokeWidth={SW} /> },
  { href: "/playoffs", label: "Playoffs", icon: <Trophy size={S} strokeWidth={SW} /> },
  { href: "/mini-jeux", label: "Mini-jeux", icon: <Gamepad2 size={S} strokeWidth={SW} /> },
  { href: "/profil", label: "Profil", icon: <User size={S} strokeWidth={SW} /> },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !user.is_anonymous) {
        const { data } = await supabase
          .from("profiles")
          .select("display_name, email, is_admin")
          .eq("id", user.id)
          .single();
        setProfile(data);
      } else {
        setProfile(null);
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

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center">
          <span className="text-xl font-bold tracking-tight text-text-primary">
            Hoop<span className="text-accent">us</span>
          </span>
        </Link>
        {/* Close button (mobile only) */}
        <button
          onClick={closeMobile}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-input hover:text-text-primary transition-colors lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

      {/* Search button */}
      <div className="px-3 mb-2">
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-text-muted hover:bg-input hover:text-text-primary transition-all duration-200"
        >
          <Search size={S} strokeWidth={SW} className="text-text-faint" />
          <span className="flex-1 text-left">Rechercher</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border-t bg-input px-1.5 py-0.5 text-[10px] font-mono text-text-faint">{"\u2318"}K</kbd>
        </button>
      </div>

      {/* Favorites */}
      <FavoriteTeams />

      {/* Navigation */}
      <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-3">
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
            {profile.is_admin && <SyncButton />}
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
            href={`/auth/login?redirect=${encodeURIComponent(pathname)}`}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-input hover:text-text-primary"
          >
            <LogIn size={16} />
            Se connecter
          </Link>
        )}
        <ThemeSelector />
        <p className="mt-3 text-xs text-text-faint">&copy; 2026 Hoopus</p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center gap-3 border-b border-border-t bg-sidebar/95 backdrop-blur-md px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-input hover:text-text-primary transition-colors"
        >
          <Menu size={22} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-hover shadow">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32" fill="none" className="text-white">
              <path d="M16 1 C16 1 20.5 5.5 20.5 9 C20.5 11.5 18.5 13 16 13 C13.5 13 11.5 11.5 11.5 9 C11.5 5.5 16 1 16 1Z" fill="currentColor" opacity="0.5" />
              <path d="M16 4 C16 4 18.5 6.5 18.5 8.5 C18.5 10 17.5 11 16 11 C14.5 11 13.5 10 13.5 8.5 C13.5 6.5 16 4 16 4Z" fill="currentColor" />
              <path d="M10 14 L22 14 L20 21 Q16 23 12 21 Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" opacity="0.3" />
              <line x1="16" y1="21" x2="16" y2="27" stroke="currentColor" strokeWidth="1.6" />
              <path d="M11 27 L21 27" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-text-primary">
            Hoop<span className="text-accent">us</span>
          </span>
        </Link>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col bg-sidebar border-r border-border-t transition-all duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:z-40`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

function FavoriteTeams() {
  const { favoriteTeams } = useFavorites();
  if (favoriteTeams.length === 0) return null;

  return (
    <div className="px-3 mb-1">
      <p className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">Favoris</p>
      <div className="flex flex-wrap gap-1 px-3">
        {favoriteTeams.map((tricode) => (
          <Link
            key={tricode}
            href={`/equipes?team=${tricode}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:bg-input hover:scale-110"
            title={tricode}
          >
            <img src={teamLogoUrl(tricode)} alt={tricode} className="h-5 w-5 object-contain" />
          </Link>
        ))}
      </div>
    </div>
  );
}

const THEMES = [
  { id: "light", label: "Clair", color: "#4f46e5" },
  { id: "dark", label: "Sombre", color: "#f97316" },
  { id: "midnight", label: "Midnight", color: "#8b5cf6" },
  { id: "emerald", label: "Emerald", color: "#10b981" },
  { id: "sakura", label: "Sakura", color: "#ec4899" },
  { id: "ocean", label: "Ocean", color: "#0ea5e9" },
] as const;

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-input hover:text-text-primary"
      >
        <Palette size={14} />
        Theme
        <span
          className="ml-auto h-3 w-3 rounded-full"
          style={{ backgroundColor: THEMES.find(t => t.id === theme)?.color }}
        />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl bg-card border border-border-t p-2 shadow-xl z-50">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                theme === t.id
                  ? "bg-accent-light text-accent"
                  : "text-text-muted hover:bg-input hover:text-text-primary"
              }`}
            >
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: t.color }}
              />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
