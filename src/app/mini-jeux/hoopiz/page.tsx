import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { RotateCcw, Plus } from "lucide-react";
import { isAdmin } from "@/lib/actions/auth";
import QuizGrid from "@/components/QuizGrid";

export const revalidate = 3600;

export default async function HoopizPage() {
  const supabase = await createClient();
  const admin = await isAdmin();

  const [{ data: quizzes }, { data: { user } }, { data: allScores }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, description, mode, time_limit, entries, published, image_url, image_position")
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
    supabase.from("quiz_scores").select("quiz_id"),
  ]);

  // Count distinct plays per quiz
  const playCountMap: Record<string, number> = {};
  if (allScores) {
    for (const s of allScores) {
      playCountMap[s.quiz_id] = (playCountMap[s.quiz_id] || 0) + 1;
    }
  }

  // Fetch user's best scores if logged in
  let userScores: Record<string, { found_count: number; total_count: number }> = {};
  if (user) {
    const { data: scores } = await supabase
      .from("quiz_scores")
      .select("quiz_id, found_count, total_count")
      .eq("user_id", user.id);
    if (scores) {
      for (const s of scores) {
        const existing = userScores[s.quiz_id];
        if (!existing || s.found_count > existing.found_count) {
          userScores[s.quiz_id] = { found_count: s.found_count, total_count: s.total_count };
        }
      }
    }
  }

  // Show published quizzes to everyone, all quizzes to admin
  // Sort by play count (most played first), then by creation date
  const visibleQuizzes = (quizzes || [])
    .filter((q) => q.published || admin)
    .sort((a, b) => (playCountMap[b.id] || 0) - (playCountMap[a.id] || 0));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      <div className="pt-4 flex items-center justify-between">
        <Link
          href="/mini-jeux"
          className="inline-flex items-center gap-1.5 rounded-lg bg-input px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
        >
          <RotateCcw size={12} /> Tous les mini-jeux
        </Link>
        {admin && (
          <Link
            href="/mini-jeux/hoopiz/create"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-hover transition-colors"
          >
            <Plus size={12} /> Nouveau quiz
          </Link>
        )}
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
          Hoop<span className="text-accent">iz</span>
        </h1>
        <p className="text-sm text-text-muted">Quiz de culture générale NBA</p>
      </div>

      <QuizGrid quizzes={visibleQuizzes} admin={admin} userScores={userScores} />
    </div>
  );
}
