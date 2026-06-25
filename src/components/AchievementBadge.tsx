"use client";

import { useState } from "react";
import {
  Trophy, Medal, Award, Crown, Flame, Zap, Star,
  Timer, Target, Gamepad2, Compass, CalendarCheck,
  BarChart3, Shield, Eye, Link, Brain, Bolt,
} from "lucide-react";
import type { Achievement } from "@/lib/achievements";

/** Map of lucide icon names to components. */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  trophy: Trophy,
  medal: Medal,
  award: Award,
  crown: Crown,
  flame: Flame,
  zap: Zap,
  star: Star,
  timer: Timer,
  target: Target,
  "gamepad-2": Gamepad2,
  compass: Compass,
  "calendar-check": CalendarCheck,
  "bar-chart-3": BarChart3,
  shield: Shield,
  eye: Eye,
  link: Link,
  brain: Brain,
  bolt: Bolt,
};

interface AchievementBadgeProps {
  achievement: Achievement;
  unlocked: boolean;
  unlockedAt?: string | null;
  compact?: boolean;
}

export default function AchievementBadge({
  achievement,
  unlocked,
  unlockedAt,
  compact = false,
}: AchievementBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const Icon = ICON_MAP[achievement.icon] || Trophy;

  const formattedDate = unlockedAt
    ? new Date(unlockedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : null;

  if (compact) {
    return (
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center border transition-colors ${
            unlocked
              ? "border-accent bg-accent-light"
              : "border-rule bg-input/30"
          }`}
        >
          <Icon size={18} className={unlocked ? "text-accent-text" : "text-text-faint"} />
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 border border-rule bg-card px-3 py-2 shadow-lg pointer-events-none">
            <p className="text-xs font-bold text-text-primary">{achievement.title}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{achievement.description}</p>
            {unlocked && formattedDate && (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-faint">Débloqué le {formattedDate}</p>
            )}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 border-r border-b border-rule bg-card" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`relative flex items-center gap-3 overflow-hidden border px-3 py-2.5 transition-colors ${
          unlocked
            ? "border-accent bg-accent-light"
            : "border-rule bg-input/30"
        }`}
      >
        {unlocked && <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center border ${
          unlocked ? "border-accent/40 bg-card" : "border-rule bg-input/50"
        }`}>
          <Icon size={18} className={unlocked ? "text-accent-text" : "text-text-faint"} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold truncate ${unlocked ? "text-text-primary" : "text-text-faint"}`}>
            {achievement.title}
          </p>
          <p className={`text-xs truncate ${unlocked ? "text-text-muted" : "text-text-faint"}`}>
            {achievement.description}
          </p>
        </div>
      </div>

      {/* Tooltip with date */}
      {showTooltip && unlocked && formattedDate && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 border border-rule bg-card px-3 py-1.5 shadow-lg pointer-events-none whitespace-nowrap">
          <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Débloqué le {formattedDate}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 border-r border-b border-rule bg-card" />
        </div>
      )}
    </div>
  );
}
