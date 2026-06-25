"use client";

import { useTheme } from "./ThemeProvider";
import { Palette, Check } from "lucide-react";

const themes = [
  {
    id: "dark" as const,
    name: "Sombre",
    desc: "Sombre et contrasté",
    colors: ["#090f1d", "#111827", "#f97316"],
  },
  {
    id: "light" as const,
    name: "Clair",
    desc: "Par defaut",
    colors: ["#f8fafc", "#ffffff", "#4f46e5"],
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
    <div className="border border-rule bg-card p-6">
      <h3 className="kicker mb-5 flex items-center gap-2 text-text-faint">
        <Palette size={13} className="text-accent" />
        Apparence
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {themes.map((t) => {
          const isActive = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`relative border p-4 text-left transition-colors ${
                isActive
                  ? "border-accent bg-accent-light"
                  : "border-rule bg-input hover:border-border-hover"
              }`}
            >
              {isActive && (
                <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center bg-accent">
                  <Check size={12} className="text-white" />
                </div>
              )}
              {/* Color preview */}
              <div className="flex gap-1.5 mb-3">
                {t.colors.map((color, i) => (
                  <div
                    key={i}
                    className="h-6 w-6"
                    style={{
                      backgroundColor: color,
                      border: color === "#ffffff" || color === "#f8fafc" ? "1px solid #e2e8f0" : "none",
                    }}
                  />
                ))}
              </div>
              <p className={`font-mono text-xs font-bold uppercase tracking-wider ${isActive ? "text-accent" : "text-text-primary"}`}>
                {t.name}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {t.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
