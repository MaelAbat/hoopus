"use client";

import { useState } from "react";
import { Clock, BookOpen, Plus, Pencil, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Article } from "@/lib/types/database";
import { deleteArticle } from "@/lib/actions/articles";
import ArticleForm from "./ArticleForm";
import DeleteButton from "./DeleteButton";

export default function ArticlesList({ articles, isAdmin }: { articles: Article[]; isAdmin: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | undefined>();

  function openCreate() {
    setEditingArticle(undefined);
    setShowForm(true);
  }

  function openEdit(article: Article) {
    setEditingArticle(article);
    setShowForm(true);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <>
      {showForm && (
        <ArticleForm article={editingArticle} onClose={() => setShowForm(false)} />
      )}

      {isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} />
            Ajouter
          </button>
        </div>
      )}

      {/* Empty state */}
      {articles.length === 0 && (
        <div className="border border-rule bg-card p-12 sm:p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center bg-input mb-5">
            <BookOpen size={28} className="text-text-faint" />
          </div>
          <p className="font-display text-2xl text-text-primary">Aucun article pour l&apos;instant</p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-text-muted">Les analyses et articles de fond apparaîtront ici.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/articles/${article.id}`}
            className="group relative flex flex-col overflow-hidden border border-rule bg-card transition-colors hover:border-border-hover"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-input">
              {article.image_url ? (
                <img
                  src={article.image_url}
                  alt={article.title}
                  className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="h-full w-full bg-input flex items-center justify-center">
                  <BookOpen size={32} className="text-text-faint/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent mix-blend-multiply" />
              <span className="absolute left-0 top-0 bg-accent px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
                {article.tag}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={(e) => { e.preventDefault(); openEdit(article); }} className="p-2 bg-black/50 text-white hover:bg-black/70 transition-colors">
                    <Pencil size={16} />
                  </button>
                  <span onClick={(e) => e.preventDefault()}>
                    <DeleteButton onDelete={() => deleteArticle(article.id)} />
                  </span>
                </div>
              )}
              <h2 className="font-display text-xl sm:text-2xl leading-[1.05] text-text-primary transition-colors group-hover:text-accent-text">
                {article.title}
              </h2>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed line-clamp-3">
                {article.excerpt}
              </p>
              <div className="mt-auto pt-4 flex items-center justify-between border-t border-rule font-mono text-[11px] uppercase tracking-wider text-text-muted">
                <span className="font-semibold text-text-secondary">{article.author}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <BookOpen size={12} />
                    <span className="tnum">{article.read_time}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    <span className="tnum">{formatDate(article.created_at)}</span>
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-accent-text opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                Lire l&apos;article
                <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
