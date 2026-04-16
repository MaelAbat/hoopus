"use client";

import { useState } from "react";
import AchievementBadge from "@/components/AchievementBadge";
import AchievementToast from "@/components/AchievementToast";
import type { Achievement } from "@/lib/achievements";

/** All 21 achievements, matching the DB seed data. */
const ALL_ACHIEVEMENTS: Achievement[] = [
  // Games
  { id: "first_win", title: "Premiere Victoire", description: "Gagner un mini-jeu pour la premiere fois", icon: "trophy", category: "games", threshold: 1 },
  { id: "win_5", title: "Habitue", description: "Gagner 5 mini-jeux", icon: "medal", category: "games", threshold: 5 },
  { id: "win_25", title: "Veteran", description: "Gagner 25 mini-jeux", icon: "award", category: "games", threshold: 25 },
  { id: "win_50", title: "Expert", description: "Gagner 50 mini-jeux", icon: "award", category: "games", threshold: 50 },
  { id: "explorer", title: "Explorateur", description: "Jouer a 3 jeux differents", icon: "compass", category: "games", threshold: 3 },
  { id: "hooprank_400", title: "Classeur d'elite", description: "Obtenir 400 ou plus au HoopRank", icon: "bar-chart-3", category: "games", threshold: 400 },
  { id: "hoopmore_10", title: "En feu", description: "Faire une serie de 10 au HoopMore", icon: "flame", category: "games", threshold: 10 },
  // Streaks
  { id: "streak_3", title: "Serie en cours", description: "Gagner 3 jours consecutifs", icon: "flame", category: "streaks", threshold: 3 },
  { id: "streak_7", title: "Semaine parfaite", description: "Gagner 7 jours consecutifs", icon: "zap", category: "streaks", threshold: 7 },
  { id: "streak_30", title: "Inarretable", description: "Gagner 30 jours consecutifs", icon: "star", category: "streaks", threshold: 30 },
  { id: "dedicated", title: "Assidu", description: "Jouer pendant 10 jours differents", icon: "calendar-check", category: "streaks", threshold: 10 },
  // Mastery
  { id: "win_100", title: "Legende", description: "Gagner 100 mini-jeux", icon: "crown", category: "mastery", threshold: 100 },
  { id: "speed_demon", title: "Speed Demon", description: "Terminer un jeu en moins de 30 secondes", icon: "timer", category: "mastery", threshold: 1 },
  { id: "speed_10", title: "Eclair", description: "Terminer un jeu en moins de 10 secondes", icon: "bolt", category: "mastery", threshold: 1 },
  { id: "perfect_hoopl", title: "Hoopl Parfait", description: "Trouver le joueur du premier coup dans Hoopl", icon: "target", category: "mastery", threshold: 1 },
  { id: "hoopixl_first", title: "Oeil de lynx", description: "Trouver le joueur du premier coup dans Hoopixl", icon: "eye", category: "mastery", threshold: 1 },
  { id: "hooprank_perfect", title: "Score Parfait", description: "Obtenir 500/500 au HoopRank", icon: "crown", category: "mastery", threshold: 500 },
  { id: "hoopmore_20", title: "Intouchable", description: "Faire une serie de 20 au HoopMore", icon: "shield", category: "mastery", threshold: 20 },
  { id: "hooplink_3", title: "Court-circuit", description: "Completer HoopLink en 3 maillons ou moins", icon: "link", category: "mastery", threshold: 3 },
  { id: "quiz_perfect", title: "Incollable", description: "Trouver toutes les reponses d'un quiz Hoopiz", icon: "brain", category: "mastery", threshold: 1 },
  { id: "all_games", title: "Polyvalent", description: "Jouer aux 7 mini-jeux dans la meme journee", icon: "gamepad-2", category: "mastery", threshold: 1 },
];

/** IDs of achievements that are "unlocked" in this test scenario. */
const UNLOCKED_IDS = new Set([
  "first_win",
  "win_5",
  "streak_3",
  "explorer",
  "speed_demon",
  "perfect_hoopl",
]);

const CATEGORY_LABELS: Record<string, string> = {
  games: "Jeux",
  streaks: "Séries",
  mastery: "Maîtrise",
};

const CATEGORY_ORDER = ["games", "streaks", "mastery"];

export default function TestAchievements() {
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function triggerSingle() {
    setDismissed(new Set());
    const pick = ALL_ACHIEVEMENTS[Math.floor(Math.random() * ALL_ACHIEVEMENTS.length)];
    setToasts([pick]);
  }

  function triggerMultiple() {
    setDismissed(new Set());
    setToasts([
      ALL_ACHIEVEMENTS[0], // Première Victoire
      ALL_ACHIEVEMENTS[4], // Série en cours
      ALL_ACHIEVEMENTS[7], // Speed Demon
    ]);
  }

  function triggerAll() {
    setDismissed(new Set());
    setToasts([...ALL_ACHIEVEMENTS]);
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, Achievement[]>>((acc, cat) => {
    acc[cat] = ALL_ACHIEVEMENTS.filter((a) => a.category === cat);
    return acc;
  }, {});

  const unlockedCount = ALL_ACHIEVEMENTS.filter((a) => UNLOCKED_IDS.has(a.id)).length;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          Test des succès
        </h1>
        <p className="mt-1 text-text-muted">
          Page de test pour visualiser les achievements
        </p>
      </div>

      {/* Toast triggers */}
      <div className="rounded-2xl border border-border-t bg-card p-6 space-y-4">
        <h2 className="text-lg font-extrabold text-text-primary">
          Notifications de déblocage
        </h2>
        <p className="text-sm text-text-muted">
          Cliquez pour simuler le déblocage d'un succès en temps réel.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={triggerSingle}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
          >
            1 succès aléatoire
          </button>
          <button
            onClick={triggerMultiple}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-500"
          >
            3 succès d'un coup
          </button>
          <button
            onClick={triggerAll}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
          >
            Tous les succès
          </button>
        </div>
      </div>

      {/* Achievements grid (mocked data) */}
      <div className="rounded-2xl border border-border-t bg-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-text-primary">Succès</h2>
          <span className="text-sm font-bold text-text-muted">
            {unlockedCount}/{ALL_ACHIEVEMENTS.length} débloqués
          </span>
        </div>

        {CATEGORY_ORDER.map((category) => {
          const items = grouped[category];
          if (!items || items.length === 0) return null;

          return (
            <div key={category} className="space-y-3">
              <h3 className="text-xs font-bold text-text-faint uppercase tracking-wide">
                {CATEGORY_LABELS[category] || category}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {items.map((achievement) => (
                  <AchievementBadge
                    key={achievement.id}
                    achievement={achievement}
                    unlocked={UNLOCKED_IDS.has(achievement.id)}
                    unlockedAt={
                      UNLOCKED_IDS.has(achievement.id)
                        ? "2026-04-16T10:30:00Z"
                        : null
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Compact badges preview */}
      <div className="rounded-2xl border border-border-t bg-card p-6 space-y-4">
        <h2 className="text-lg font-extrabold text-text-primary">
          Badges compacts
        </h2>
        <div className="flex flex-wrap gap-2">
          {ALL_ACHIEVEMENTS.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              unlocked={UNLOCKED_IDS.has(achievement.id)}
              unlockedAt={
                UNLOCKED_IDS.has(achievement.id)
                  ? "2026-04-16T10:30:00Z"
                  : null
              }
              compact
            />
          ))}
        </div>
      </div>

      {/* Achievement toasts */}
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
    </div>
  );
}
