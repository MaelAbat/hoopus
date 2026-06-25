import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { RotateCcw, Plus } from "lucide-react";
import { isAdmin } from "@/lib/actions/auth";
import QuizGrid from "@/components/QuizGrid";
import { OG_IMAGE } from "@/lib/seo";

export const revalidate = 3600;

const description =
  "Hoopiz : le quiz de culture générale NBA. Remplis le tableau le plus vite possible, chrono en main, et grimpe au classement. Teste tes connaissances sur Hoopus.";

export const metadata = {
  title: "Hoopiz — Quiz de culture NBA",
  description,
  alternates: { canonical: "/mini-jeux/hoopiz" },
  openGraph: { title: "Hoopiz — Quiz de culture NBA · Hoopus", description, images: [OG_IMAGE] },
};

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
          className="inline-flex items-center gap-2 sm:gap-1.5 border border-rule bg-card px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:border-border-hover hover:text-text-primary transition-colors"
        >
          <RotateCcw size={12} /> Tous les mini-jeux
        </Link>
        {admin && (
          <Link
            href="/mini-jeux/hoopiz/create"
            className="inline-flex items-center gap-1.5 bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest text-white hover:bg-accent-hover transition-colors"
          >
            <Plus size={12} /> Nouveau quiz
          </Link>
        )}
      </div>

      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl text-text-primary">
          Hoop<span className="text-accent">iz</span>
        </h1>
        <p className="kicker text-text-faint">Quiz de culture générale NBA</p>
      </div>

      <QuizGrid quizzes={visibleQuizzes} admin={admin} userScores={userScores} />
    </div>
  );
}
