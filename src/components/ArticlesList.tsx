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
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            <Plus size={16} />
            Ajouter
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/articles/${article.id}`}
            className="group relative overflow-hidden rounded-2xl bg-card border border-border-t transition-all duration-300 hover:border-border-hover hover:shadow-lg"
          >
            {article.image_url && (
              <div className="aspect-[16/9] w-full overflow-hidden bg-input">
                <img
                  src={article.image_url}
                  alt={article.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            )}
            <div className="p-5 sm:p-6">
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={(e) => { e.preventDefault(); openEdit(article); }} className="rounded-lg p-2 bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors">
                    <Pencil size={16} />
                  </button>
                  <span onClick={(e) => e.preventDefault()}>
                    <DeleteButton onDelete={() => deleteArticle(article.id)} />
                  </span>
                </div>
              )}
              <span className="inline-block rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-text">
                {article.tag}
              </span>
              <h2 className="mt-3 text-lg sm:text-xl font-bold text-text-primary leading-snug transition-colors group-hover:text-accent-text">
                {article.title}
              </h2>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed line-clamp-3">
                {article.excerpt}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border-t pt-4">
                <span className="text-sm font-medium text-text-secondary">{article.author}</span>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <BookOpen size={12} />
                    {article.read_time}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatDate(article.created_at)}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
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
