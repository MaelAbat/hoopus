import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import HoopizGame from "@/components/HoopizGame";

export const revalidate = 3600;

interface QuizEntry {
  label: string;
  answers: string[];
}

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", id)
    .single();

  if (!quiz) notFound();

  // Convert DB format to game format
  const entries = (quiz.entries as QuizEntry[]).map((e) => ({
    answers: e.answers,
    hints: { label: e.label },
  }));

  const gameQuiz = {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    timeLimit: quiz.time_limit,
    mode: quiz.mode as "unordered" | "ordered",
    columns: [
      { key: "label", label: "", width: "auto" },
      { key: "answer", label: "Réponse", width: "auto" },
    ],
    answerColumn: "answer",
    entries,
    imageUrl: quiz.image_url || undefined,
    imagePosition: quiz.image_position || "center",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      <HoopizGame quiz={gameQuiz} />
    </div>
  );
}
