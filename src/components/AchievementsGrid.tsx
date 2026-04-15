"use client";

import { useEffect, useState } from "react";
import { fetchAllAchievements, type Achievement } from "@/lib/achievements";
import AchievementBadge from "./AchievementBadge";
import { createClient } from "@/lib/supabase/client";

interface AchievementWithStatus {
  achievement: Achievement;
  unlocked: boolean;
  unlockedAt: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  games: "Jeux",
  streaks: "Séries",
  mastery: "Maîtrise",
};

const CATEGORY_ORDER = ["games", "streaks", "mastery"];

export default function AchievementsGrid() {
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      try {
        const data = await fetchAllAchievements(user?.id || null);
        setAchievements(data);
      } catch {
        // Table may not exist yet
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border-t bg-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded bg-white/5" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  // Group by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, AchievementWithStatus[]>>((acc, cat) => {
    acc[cat] = achievements.filter((a) => a.achievement.category === cat);
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-border-t bg-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-text-primary">Succès</h2>
        <span className="text-sm font-bold text-text-muted">
          {unlockedCount}/{totalCount} débloqués
        </span>
      </div>

      {/* Category sections */}
      {CATEGORY_ORDER.map((category) => {
        const items = grouped[category];
        if (!items || items.length === 0) return null;

        return (
          <div key={category} className="space-y-3">
            <h3 className="text-xs font-bold text-text-faint uppercase tracking-wide">
              {CATEGORY_LABELS[category] || category}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {items.map(({ achievement, unlocked, unlockedAt }) => (
                <AchievementBadge
                  key={achievement.id}
                  achievement={achievement}
                  unlocked={unlocked}
                  unlockedAt={unlockedAt}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
