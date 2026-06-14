"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Theme = "dark" | "light" | "midnight" | "emerald" | "sakura" | "ocean";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Keep the browser/PWA chrome (status bar + nav bar) matching the active theme
 * by syncing <meta name="theme-color"> to the theme's sidebar background. Reads
 * the computed CSS variable so globals.css stays the single source of truth.
 */
function syncThemeColor() {
  if (typeof document === "undefined") return;
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue("--bg-sidebar")
    .trim();
  if (!color) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Keep the chrome color in sync whenever the active theme changes.
  useEffect(() => {
    syncThemeColor();
  }, [theme]);

  useEffect(() => {
    // Load theme from profile or localStorage fallback
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) {
      setThemeState(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else {
      // Default: dark on desktop, light on mobile
      const defaultTheme: Theme = window.innerWidth >= 1024 ? "dark" : "light";
      setThemeState(defaultTheme);
      document.documentElement.setAttribute("data-theme", defaultTheme);
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profiles")
          .select("theme")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data?.theme) {
              setThemeState(data.theme as Theme);
              document.documentElement.setAttribute("data-theme", data.theme);
              localStorage.setItem("theme", data.theme);
            }
          });
      }
    });
  }, []);

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);

    // Persist to DB if logged in
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profiles")
          .update({ theme: newTheme })
          .eq("id", user.id)
          .then(() => {});
      }
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
