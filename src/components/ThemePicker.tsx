"use client";

import { useTheme } from "./ThemeProvider";
import { Palette, Check } from "lucide-react";

const themes = [
  {
    id: "dark" as const,
    name: "Sombre",
    desc: "Thème par défaut",
    colors: ["#090f1d", "#111827", "#f97316"],
  },
  {
    id: "light" as const,
    name: "Clair",
    desc: "Lumineux et épuré",
    colors: ["#f8fafc", "#ffffff", "#ea580c"],
  },
  {
    id: "midnight" as const,
    name: "Midnight",
    desc: "Violet profond",
    colors: ["#0b0a1a", "#13112a", "#8b5cf6"],
  },
  {
    id: "emerald" as const,
    name: "Emerald",
    desc: "Vert émeraude",
    colors: ["#071a12", "#0d2818", "#10b981"],
  },
  {
    id: "sakura" as const,
    name: "Sakura",
    desc: "Rose cerisier",
    colors: ["#1a0a12", "#281218", "#ec4899"],
  },
  {
    id: "ocean" as const,
    name: "Ocean",
    desc: "Bleu profond",
    colors: ["#060e1f", "#0c1a30", "#0ea5e9"],
  },
];

export default function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="rounded-2xl border p-6" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
      <h3 className="flex items-center gap-2 font-bold mb-5" style={{ color: "var(--text)" }}>
        <Palette size={16} style={{ color: "var(--accent)" }} />
        Apparence
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {themes.map((t) => {
          const isActive = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className="relative rounded-xl p-4 text-left transition-all duration-200"
              style={{
                backgroundColor: isActive ? "var(--accent-light)" : "var(--bg-input)",
                borderWidth: "1.5px",
                borderStyle: "solid",
                borderColor: isActive ? "var(--accent)" : "var(--border)",
              }}
            >
              {isActive && (
                <div
                  className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  <Check size={12} className="text-white" />
                </div>
              )}
              {/* Color preview */}
              <div className="flex gap-1.5 mb-3">
                {t.colors.map((color, i) => (
                  <div
                    key={i}
                    className="h-6 w-6 rounded-lg"
                    style={{
                      backgroundColor: color,
                      border: color === "#ffffff" || color === "#f8fafc" ? "1px solid #e2e8f0" : "none",
                    }}
                  />
                ))}
              </div>
              <p className="text-sm font-semibold" style={{ color: isActive ? "var(--accent)" : "var(--text)" }}>
                {t.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {t.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
