import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { RotateCcw, Clock, List, ListOrdered, Plus, Pencil } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import { isAdmin } from "@/lib/actions/auth";

export const revalidate = 3600;

export default async function HoopizPage() {
  const supabase = await createClient();
  const admin = await isAdmin();

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, title, description, mode, time_limit, entries, published, image_url")
    .order("created_at", { ascending: false });

  // Show published quizzes to everyone, all quizzes to admin
  const visibleQuizzes = (quizzes || []).filter((q) => q.published || admin);

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

      {visibleQuizzes.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border-t px-6 py-12 text-center text-sm text-text-muted">
          Aucun quiz disponible pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleQuizzes.map((quiz, i) => {
            const entryCount = Array.isArray(quiz.entries) ? quiz.entries.length : 0;
            return (
              <ScrollReveal key={quiz.id} delay={i * 80} variant="up">
                <div className="relative">
                  <Link
                    href={`/mini-jeux/hoopiz/${quiz.id}`}
                    className="group flex flex-col rounded-2xl bg-card border border-border-t overflow-hidden transition-all duration-200 hover:border-accent/50 hover:shadow-lg hover:-translate-y-1"
                  >
                    {quiz.image_url && (
                      <div className="h-32 w-full overflow-hidden">
                        <img
                          src={quiz.image_url}
                          alt={quiz.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h2 className="text-lg font-bold text-text-primary group-hover:text-accent-text transition-colors">
                        {quiz.title}
                      </h2>
                      {!quiz.published && (
                        <span className="shrink-0 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                          Brouillon
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-muted flex-1">{quiz.description}</p>
                    <div className="flex items-center gap-3 mt-3 text-[11px] text-text-faint">
                      <span className="flex items-center gap-1">
                        {quiz.mode === "ordered" ? <ListOrdered size={12} /> : <List size={12} />}
                        {quiz.mode === "ordered" ? "Dans l'ordre" : "Désordre"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {Math.floor(quiz.time_limit / 60)} min
                      </span>
                      <span>{entryCount} réponse{entryCount > 1 ? "s" : ""}</span>
                    </div>
                    </div>
                  </Link>
                  {admin && (
                    <Link
                      href={`/mini-jeux/hoopiz/${quiz.id}/edit`}
                      className="absolute top-3 right-3 rounded-lg p-1.5 text-text-faint hover:text-accent-text hover:bg-accent/10 transition-colors z-10"
                    >
                      <Pencil size={13} />
                    </Link>
                  )}
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
