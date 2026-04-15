"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useSearchParams } from "next/navigation";
import { decodeChallenge } from "./ChallengeShare";
import ChallengeShare from "./ChallengeShare";
import ChallengeResult from "./ChallengeResult";
import AchievementToast from "./AchievementToast";
import { checkAchievements, type Achievement } from "@/lib/achievements";
import { createClient } from "@/lib/supabase/client";
import { Swords } from "lucide-react";

export interface GameResult {
  score: number;
  timeSeconds: number;
  won: boolean;
}

interface ChallengeContextValue {
  /** Call this when the game finishes to trigger challenge comparison + achievements. */
  reportCompletion: (result: GameResult) => void;
  /** True when the current session is a challenge (URL has ?challenge=). */
  isChallenge: boolean;
  /** The challenge date, if from a challenge link. */
  challengeDate: string | null;
}

const ChallengeContext = createContext<ChallengeContextValue>({
  reportCompletion: () => {},
  isChallenge: false,
  challengeDate: null,
});

/** Hook for game components to report completion and check challenge state. */
export function useChallenge() {
  return useContext(ChallengeContext);
}

export interface ChallengeWrapperProps {
  gameName: string;
  gameDate: string;
  children: React.ReactNode;
}

export default function ChallengeWrapper({
  gameName,
  gameDate,
  children,
}: ChallengeWrapperProps) {
  const searchParams = useSearchParams();
  const challengeParam = searchParams.get("challenge");

  const [challengerData, setChallengerData] = useState<{
    date: string;
    score: number;
    time: number;
    won: boolean;
  } | null>(null);

  const [myResult, setMyResult] = useState<GameResult | null>(null);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [dismissedAchievements, setDismissedAchievements] = useState<Set<string>>(new Set());

  // Decode challenge param
  useEffect(() => {
    if (challengeParam) {
      const decoded = decodeChallenge(challengeParam);
      if (decoded) {
        setChallengerData(decoded);
      }
    }
  }, [challengeParam]);

  const reportCompletion = useCallback(async (result: GameResult) => {
    setMyResult(result);

    // Check achievements
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        const unlocked = await checkAchievements(user.id);
        if (unlocked.length > 0) {
          setNewAchievements(unlocked);
        }
      } catch {
        // Silently fail if achievements table doesn't exist yet
      }
    }
  }, []);

  const handleDismissAchievement = useCallback((id: string) => {
    setDismissedAchievements((prev) => new Set(prev).add(id));
  }, []);

  const isChallenge = !!challengerData;
  const challengeDate = challengerData?.date || null;

  return (
    <ChallengeContext.Provider value={{ reportCompletion, isChallenge, challengeDate }}>
      {/* Challenge banner when playing from a challenge link */}
      {isChallenge && !myResult && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
          <Swords size={18} className="text-accent-text shrink-0" />
          <p className="text-sm font-medium text-text-muted">
            Vous avez été défié ! Terminez la partie pour comparer vos résultats.
          </p>
        </div>
      )}

      {children}

      {/* Post-game: challenge result or share button */}
      {myResult && (
        <div className="mt-6 space-y-4">
          {isChallenge && challengerData ? (
            <ChallengeResult
              challengerScore={challengerData.score}
              challengerTime={challengerData.time}
              challengerWon={challengerData.won}
              myScore={myResult.score}
              myTime={myResult.timeSeconds}
              myWon={myResult.won}
              gameName={gameName}
              gameDate={gameDate}
            />
          ) : (
            <div className="flex justify-center">
              <ChallengeShare
                gameName={gameName}
                gameDate={gameDate}
                score={myResult.score}
                timeSeconds={myResult.timeSeconds}
                won={myResult.won}
              />
            </div>
          )}
        </div>
      )}

      {/* Achievement toasts */}
      {newAchievements
        .filter((a) => !dismissedAchievements.has(a.id))
        .map((achievement, index) => (
          <AchievementToast
            key={achievement.id}
            achievement={achievement}
            index={index}
            onDismiss={() => handleDismissAchievement(achievement.id)}
          />
        ))}
    </ChallengeContext.Provider>
  );
}
