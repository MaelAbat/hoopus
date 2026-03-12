"use client";

import { useState } from "react";
import { Clock, BookOpen, Plus, Pencil } from "lucide-react";
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Articles</h1>
          <p className="mt-1 text-text-muted">Analyses, décryptages et portraits</p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            <Plus size={16} />
            Ajouter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {articles.map((article) => (
          <article
            key={article.id}
            className="group relative rounded-2xl bg-card border border-border-t p-6 transition-all duration-300 hover:border-border-hover hover:shadow-lg"
          >
            {isAdmin && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(article)} className="rounded-lg p-2 text-text-faint hover:bg-input hover:text-text-primary transition-colors">
                  <Pencil size={16} />
                </button>
                <DeleteButton onDelete={() => deleteArticle(article.id)} />
              </div>
            )}
            <span className="inline-block rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-text">
              {article.tag}
            </span>
            <h2 className="mt-4 text-xl font-bold text-text-primary leading-snug transition-colors group-hover:text-accent-text">
              {article.title}
            </h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              {article.excerpt}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-border-t pt-4">
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
          </article>
        ))}
      </div>
    </>
  );
}
