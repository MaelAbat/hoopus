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
      <div className="border border-rule bg-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-input/30" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-input/30" />
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
    <div className="border border-rule bg-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl text-text-primary sm:text-3xl">Succès</h2>
        <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
          <span className="tnum font-bold text-text-primary">{unlockedCount}</span>
          <span className="text-text-faint">/{totalCount}</span> débloqués
        </span>
      </div>

      {/* Category sections */}
      {CATEGORY_ORDER.map((category) => {
        const items = grouped[category];
        if (!items || items.length === 0) return null;

        return (
          <div key={category} className="space-y-3">
            <h3 className="kicker text-text-faint">
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
