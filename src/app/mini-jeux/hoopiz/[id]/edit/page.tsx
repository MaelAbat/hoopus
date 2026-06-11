import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/auth";
import { redirect, notFound } from "next/navigation";
import QuizEditor from "@/components/QuizEditor";

export const metadata = {
  title: "Modifier le quiz",
  robots: { index: false, follow: false },
};

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await isAdmin();
  if (!admin) redirect("/mini-jeux/hoopiz");

  const { id } = await params;
  const supabase = await createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", id)
    .single();

  if (!quiz) notFound();

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-0 pb-8">
      <QuizEditor existing={quiz} />
    </div>
  );
}
