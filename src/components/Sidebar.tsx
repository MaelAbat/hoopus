"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Newspaper,
  FileText,
  BarChart3,
  Calendar,
  User,
  Trophy,
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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-[#0c1222] border-r border-white/5">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20">
          <Trophy size={20} className="text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">
          NBA<span className="text-orange-500">Hub</span>
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
                  ? "bg-orange-500/10 text-orange-500 shadow-sm"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span
                className={`transition-colors duration-200 ${
                  isActive
                    ? "text-orange-500"
                    : "text-gray-500 group-hover:text-white"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 px-6 py-4">
        <p className="text-xs text-gray-600">© 2026 NBAHub</p>
      </div>
    </aside>
  );
}
