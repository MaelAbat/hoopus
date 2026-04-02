"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Clock, List, ListOrdered, Pencil, Search, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

interface Quiz {
  id: string;
  title: string;
  description: string;
  mode: string;
  time_limit: number;
  entries: unknown[];
  published: boolean;
  image_url: string | null;
  image_position?: string;
}

const PER_PAGE = 12;

interface UserScore {
  found_count: number;
  total_count: number;
}

export default function QuizGrid({ quizzes, admin, userScores = {} }: { quizzes: Quiz[]; admin: boolean; userScores?: Record<string, UserScore> }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return quizzes;
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = normalize(search);
    return quizzes.filter(
      (quiz) =>
        normalize(quiz.title).includes(q) ||
        normalize(quiz.description).includes(q)
    );
  }, [quizzes, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // Reset to page 1 when search changes
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher un quiz..."
          className="w-full rounded-xl bg-card border border-border-t pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Pagination top */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                p === currentPage
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-text-primary hover:bg-card-hover"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Grid */}
      {paginated.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border-t px-6 py-12 text-center text-sm text-text-muted">
          {search.trim() ? "Aucun quiz trouvé." : "Aucun quiz disponible pour le moment."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {paginated.map((quiz, i) => {
            const entryCount = Array.isArray(quiz.entries) ? quiz.entries.length : 0;
            return (
              <ScrollReveal key={quiz.id} delay={i * 60} variant="up">
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
                          style={{ objectPosition: `center ${quiz.image_position || "center"}` }}
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
                      {userScores[quiz.id] && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Trophy size={12} className={userScores[quiz.id].found_count === userScores[quiz.id].total_count ? "text-emerald-400" : "text-accent-text"} />
                          <span className={`text-xs font-bold ${userScores[quiz.id].found_count === userScores[quiz.id].total_count ? "text-emerald-400" : "text-accent-text"}`}>
                            {userScores[quiz.id].found_count}/{userScores[quiz.id].total_count}
                          </span>
                        </div>
                      )}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                p === currentPage
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-text-primary hover:bg-card-hover"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
