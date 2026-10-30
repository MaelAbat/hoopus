import { createPublicClient } from "@/lib/supabase/public";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import HoopizGame from "@/components/HoopizGame";
import { OG_IMAGE } from "@/lib/seo";

export const revalidate = 3600;

// Liste vide : aucune page générée au build, chacune est rendue à sa première
// visite puis servie depuis le cache. Sans cette déclaration, un segment
// dynamique est rendu à chaque requête et `revalidate` reste lettre morte.
export function generateStaticParams() {
  return [];
}

interface QuizEntry {
  label: string;
  answers: string[];
}

const getQuiz = cache(async (id: string) => {
  const supabase = createPublicClient();
  const { data } = await supabase.from("quizzes").select("*").eq("id", id).single();
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const quiz = await getQuiz(id);
  if (!quiz) return { title: "Quiz introuvable", robots: { index: false, follow: false } };
  const description = quiz.description || `${quiz.title} — un quiz NBA à relever sur Hoopus.`;
  return {
    title: `${quiz.title} — Quiz NBA`,
    description,
    alternates: { canonical: `/mini-jeux/hoopiz/${id}` },
    openGraph: { title: `${quiz.title} · Hoopiz`, description, images: [OG_IMAGE] },
  };
}

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quiz = await getQuiz(id);

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
