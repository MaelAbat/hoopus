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

/** Category-based accent colors. */
const CATEGORY_COLORS: Record<string, { ring: string; bg: string; text: string; glow: string }> = {
  games: {
    ring: "ring-orange-500/40",
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    glow: "shadow-[0_0_12px_rgba(249,115,22,0.25)]",
  },
  streaks: {
    ring: "ring-violet-500/40",
    bg: "bg-violet-500/15",
    text: "text-violet-400",
    glow: "shadow-[0_0_12px_rgba(139,92,246,0.25)]",
  },
  mastery: {
    ring: "ring-emerald-500/40",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    glow: "shadow-[0_0_12px_rgba(16,185,129,0.25)]",
  },
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
  const colors = CATEGORY_COLORS[achievement.category] || CATEGORY_COLORS.games;

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
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
            unlocked
              ? `${colors.bg} ${colors.ring} ring-1 ${colors.glow}`
              : "bg-white/[0.03] ring-1 ring-white/[0.06]"
          }`}
        >
          <Icon size={18} className={unlocked ? colors.text : "text-text-muted"} />
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 rounded-lg border border-border-t bg-card px-3 py-2 shadow-lg pointer-events-none">
            <p className="text-xs font-bold text-text-primary">{achievement.title}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{achievement.description}</p>
            {unlocked && formattedDate && (
              <p className="text-[10px] text-text-faint mt-1">Débloqué le {formattedDate}</p>
            )}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 border-r border-b border-border-t bg-card" />
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
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
          unlocked
            ? `${colors.bg} ${colors.ring} ring-1 ${colors.glow}`
            : "bg-white/[0.03] ring-1 ring-white/[0.06]"
        }`}
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          unlocked ? colors.bg : "bg-white/[0.06]"
        }`}>
          <Icon size={18} className={unlocked ? colors.text : "text-text-muted"} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold truncate ${unlocked ? "text-text-primary" : "text-text-muted"}`}>
            {achievement.title}
          </p>
          <p className={`text-xs truncate ${unlocked ? "text-text-muted" : "text-text-faint"}`}>
            {achievement.description}
          </p>
        </div>
      </div>

      {/* Tooltip with date */}
      {showTooltip && unlocked && formattedDate && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 rounded-lg border border-border-t bg-card px-3 py-1.5 shadow-lg pointer-events-none whitespace-nowrap">
          <p className="text-[11px] text-text-muted">Débloqué le {formattedDate}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 border-r border-b border-border-t bg-card" />
        </div>
      )}
    </div>
  );
}
