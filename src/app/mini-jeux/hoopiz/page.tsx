import { QUIZZES } from "@/lib/quiz-data";
import HoopizGame from "@/components/HoopizGame";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function HoopizPage() {
  // For now, load the first quiz
  const quiz = QUIZZES[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      <div className="pt-4">
        <Link
          href="/mini-jeux"
          className="inline-flex items-center gap-1.5 rounded-lg bg-input px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
        >
          <RotateCcw size={12} /> Tous les mini-jeux
        </Link>
      </div>
      <HoopizGame quiz={quiz} />
    </div>
  );
}
