"use client";

import { createContext, useCallback, useContext, useState } from "react";
import AchievementToast from "./AchievementToast";
import { checkAchievements, type Achievement } from "@/lib/achievements";
import { createClient } from "@/lib/supabase/client";

interface AchievementContextValue {
  /** Call after a score is submitted to check & show newly unlocked achievements. */
  triggerCheck: () => Promise<void>;
}

const AchievementContext = createContext<AchievementContextValue>({
  triggerCheck: async () => {},
});

export function useAchievementNotifier() {
  return useContext(AchievementContext);
}

export default function AchievementProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const triggerCheck = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const unlocked = await checkAchievements(user.id);
      if (unlocked.length > 0) {
        setDismissed(new Set());
        setToasts(unlocked);
      }
    } catch {
      // achievements table may not exist yet
    }
  }, []);

  return (
    <AchievementContext.Provider value={{ triggerCheck }}>
      {children}
      {toasts
        .filter((a) => !dismissed.has(a.id))
        .map((achievement, index) => (
          <AchievementToast
            key={achievement.id}
            achievement={achievement}
            index={index}
            onDismiss={() =>
              setDismissed((prev) => new Set(prev).add(achievement.id))
            }
          />
        ))}
    </AchievementContext.Provider>
  );
}
