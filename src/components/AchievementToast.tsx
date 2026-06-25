"use client";

import { useEffect, useState } from "react";
import {
  Trophy, Medal, Award, Crown, Flame, Zap, Star,
  Timer, Target, Gamepad2, Compass, CalendarCheck,
  BarChart3, Shield, Eye, Link, Brain, Bolt,
} from "lucide-react";
import type { Achievement } from "@/lib/achievements";

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

interface AchievementToastProps {
  achievement: Achievement;
  index?: number;
  onDismiss: () => void;
}

export default function AchievementToast({
  achievement,
  index = 0,
  onDismiss,
}: AchievementToastProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const Icon = ICON_MAP[achievement.icon] || Trophy;

  useEffect(() => {
    // Stagger entrance for multiple toasts
    const enterDelay = setTimeout(() => setVisible(true), index * 300 + 100);

    // Auto-dismiss after 4 seconds
    const dismissDelay = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 400); // Wait for exit animation
    }, 4000 + index * 300);

    return () => {
      clearTimeout(enterDelay);
      clearTimeout(dismissDelay);
    };
  }, [index, onDismiss]);

  return (
    <div
      className={`fixed z-50 overflow-hidden border border-rule bg-card shadow-xl p-4 transition-all duration-400 ease-out ${
        visible && !exiting
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4"
      }`}
      style={{
        bottom: `${1 + index * 5}rem`,
        right: "1rem",
        maxWidth: "320px",
      }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-accent">
          <Icon size={20} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="kicker text-accent-text">
            Succès débloqué
          </p>
          <p className="text-sm font-bold text-text-primary mt-1 truncate">
            {achievement.title}
          </p>
          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
            {achievement.description}
          </p>
        </div>
      </div>
    </div>
  );
}
