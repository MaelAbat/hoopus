"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  LogIn,
  LogOut,
  Shield,
  Menu,
  X,
  Palette,
  Search,
} from "lucide-react";
import SyncButton from "./SyncButton";
import { useTheme } from "./ThemeProvider";
import { useFavorites } from "@/context/FavoritesContext";
import { teamLogoUrl } from "@/lib/nba-teams";

interface NavItem {
  href: string;
  label: string;
}

// Broadcast rundown — no icons, just numbered cues.
const navItems: NavItem[] = [
  { href: "/", label: "Accueil" },
  { href: "/actualites", label: "Actualités" },
  { href: "/articles", label: "Articles" },
  { href: "/statistiques", label: "Statistiques" },
  { href: "/calendrier", label: "Calendrier" },
  { href: "/classement", label: "Classement" },
  { href: "/equipes", label: "Équipes" },
  { href: "/joueurs", label: "Joueurs" },
  { href: "/blessures", label: "Infirmerie" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/mini-jeux", label: "Mini-jeux" },
  { href: "/profil", label: "Profil" },
];

interface UserProfile {
  display_name: string;
  email: string;
  is_admin: boolean;
}

export default function Sidebar({
  hasNews = true,
  hasArticles = true,
}: {
  hasNews?: boolean;
  hasArticles?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Hide the Actualités / Articles entries when nothing has been published yet.
  const visibleNavItems = navItems.filter((item) => {
    if (item.href === "/actualites") return hasNews;
    if (item.href === "/articles") return hasArticles;
    return true;
  });
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
      {/* Masthead */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-start justify-between">
          <Link href="/" className="block leading-none">
            <span className="font-display text-[26px] tracking-tight text-text-primary">
              HOOP<span className="text-accent">US</span>
            </span>
          </Link>
          {/* Close button (mobile only) */}
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Fermer le menu"
            className="flex h-8 w-8 items-center justify-center text-text-muted hover:bg-input hover:text-text-primary transition-colors lg:hidden"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <span className="block h-[2px] w-7 bg-accent" />
          <span className="kicker text-text-faint">NBA · France</span>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 mb-5">
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="flex w-full items-center gap-2.5 border border-rule bg-input/40 px-3 py-2.5 text-xs text-text-muted hover:border-border-hover hover:text-text-primary transition-colors"
        >
          <Search size={15} strokeWidth={1.75} className="text-text-faint shrink-0" />
          <span className="flex-1 text-left font-mono uppercase tracking-wider text-[11px]">Rechercher</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 border border-rule px-1.5 py-0.5 text-[10px] font-mono text-text-faint">{"⌘"}K</kbd>
        </button>
      </div>

      {/* Favorites */}
      <FavoriteTeams />

      {/* Navigation rundown */}
      <nav className="flex flex-1 flex-col overflow-y-auto border-t border-rule">
        {visibleNavItems.map((item, i) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-baseline gap-3 border-b border-rule/60 py-2.5 pl-5 pr-4 transition-colors duration-150 ${
                isActive
                  ? "bg-input text-text-primary"
                  : "text-text-muted hover:bg-input/50 hover:text-text-primary"
              }`}
            >
              {/* Active cue bar */}
              <span
                className={`absolute left-0 top-0 bottom-0 w-[3px] bg-accent transition-transform duration-150 ${
                  isActive ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"
                }`}
              />
              <span
                className={`font-mono text-[11px] tabular-nums tracking-tight ${
                  isActive ? "text-accent" : "text-text-faint group-hover:text-text-muted"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[13px] font-semibold uppercase tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-rule px-5 py-4">
        {loading ? (
          <div className="h-10 animate-pulse bg-input" />
        ) : profile ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center bg-accent font-display text-base text-white">
                {profile.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {profile.display_name}
                </p>
                <div className="flex items-center gap-1">
                  {profile.is_admin ? (
                    <span className="inline-flex items-center gap-1 kicker text-accent-text">
                      <Shield size={10} />
                      Admin
                    </span>
                  ) : (
                    <span className="kicker text-text-faint">Membre</span>
                  )}
                </div>
              </div>
            </div>
            {profile.is_admin && <SyncButton />}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 border border-rule px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary"
            >
              <LogOut size={13} />
              Déconnexion
            </button>
          </div>
        ) : (
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(pathname)}`}
            className="flex items-center gap-2 border border-rule px-3 py-2.5 text-[11px] font-mono uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary"
          >
            <LogIn size={14} />
            Se connecter
          </Link>
        )}
        <ThemeSelector />
        <p className="mt-3 kicker text-text-faint">&copy; 2026 Hoopus</p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center gap-3 border-b border-rule bg-sidebar px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Ouvrir le menu de navigation"
          className="flex h-9 w-9 items-center justify-center text-text-muted hover:bg-input hover:text-text-primary transition-colors"
        >
          <Menu size={22} />
        </button>
        <Link href="/" className="flex items-center leading-none">
          <span className="font-display text-xl tracking-tight text-text-primary">
            HOOP<span className="text-accent">US</span>
          </span>
        </Link>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col bg-sidebar border-r border-rule transition-transform duration-300 ${
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
    <div className="px-5 mb-4">
      <p className="kicker mb-2 text-text-faint">Favoris</p>
      <div className="flex flex-wrap gap-1.5">
        {favoriteTeams.map((tricode) => (
          <Link
            key={tricode}
            href={`/equipes?team=${tricode}`}
            className="flex h-8 w-8 items-center justify-center border border-rule transition-all duration-150 hover:border-border-hover hover:bg-input"
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
  { id: "light", label: "Clair", color: "#e23a0e" },
  { id: "dark", label: "Sombre", color: "#ff5a1f" },
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
        className="flex w-full items-center gap-2 px-1 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
      >
        <Palette size={13} />
        Thème
        <span
          className="ml-auto h-3 w-3"
          style={{ backgroundColor: THEMES.find(t => t.id === theme)?.color }}
        />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 border border-rule bg-card p-1.5 shadow-xl z-50">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-mono uppercase tracking-wider transition-colors ${
                theme === t.id
                  ? "bg-accent-light text-accent"
                  : "text-text-muted hover:bg-input hover:text-text-primary"
              }`}
            >
              <span
                className="h-3 w-3 shrink-0"
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
