"use client";

import { useState } from "react";
import { Clock, ArrowRight, Plus, Pencil } from "lucide-react";
import type { News } from "@/lib/types/database";
import { deleteNews } from "@/lib/actions/news";
import NewsForm from "./NewsForm";
import DeleteButton from "./DeleteButton";

export default function NewsList({ news, isAdmin }: { news: News[]; isAdmin: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [editingNews, setEditingNews] = useState<News | undefined>();

  const featured = news.find((n) => n.featured);
  const others = news.filter((n) => !n.featured);

  function openCreate() {
    setEditingNews(undefined);
    setShowForm(true);
  }

  function openEdit(item: News) {
    setEditingNews(item);
    setShowForm(true);
  }

  function formatTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Il y a quelques minutes";
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  }

  return (
    <>
      {showForm && (
        <NewsForm news={editingNews} onClose={() => setShowForm(false)} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Actualités</h1>
          <p className="mt-1 text-text-muted">Les dernières nouvelles de la NBA</p>
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

      {/* Featured */}
      {featured && (
        <div className="group relative rounded-2xl bg-gradient-to-br from-accent-light to-transparent border border-accent/20 p-8 transition-all duration-300 hover:border-accent/40 hover:shadow-lg">
          {isAdmin && (
            <div className="absolute top-4 right-4 flex gap-2">
              <button onClick={() => openEdit(featured)} className="rounded-lg p-2 text-text-faint hover:bg-input hover:text-text-primary transition-colors">
                <Pencil size={16} />
              </button>
              <DeleteButton onDelete={() => deleteNews(featured.id)} />
            </div>
          )}
          <span className="inline-block rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-text">
            {featured.category}
          </span>
          <h2 className="mt-4 text-2xl font-bold text-text-primary">{featured.title}</h2>
          <p className="mt-2 text-text-secondary leading-relaxed">{featured.excerpt}</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Clock size={14} />
              {formatTime(featured.created_at)}
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-accent">
              Lire la suite <ArrowRight size={14} />
            </span>
          </div>
        </div>
      )}

      {/* News list */}
      <div className="space-y-3">
        {others.map((item) => (
          <div
            key={item.id}
            className="group relative rounded-2xl bg-card border border-border-t p-6 transition-all duration-200 hover:border-border-hover hover:shadow-lg"
          >
            {isAdmin && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(item)} className="rounded-lg p-2 text-text-faint hover:bg-input hover:text-text-primary transition-colors">
                  <Pencil size={16} />
                </button>
                <DeleteButton onDelete={() => deleteNews(item.id)} />
              </div>
            )}
            <div className="flex items-start justify-between gap-4 pr-20">
              <div className="flex-1">
                <span className="inline-block rounded-full bg-input px-3 py-1 text-xs font-medium text-text-muted">
                  {item.category}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-1 text-sm text-text-muted leading-relaxed">{item.excerpt}</p>
              </div>
              <ArrowRight size={16} className="mt-8 shrink-0 text-text-faint transition-all group-hover:translate-x-1 group-hover:text-accent" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-text-faint">
              <Clock size={12} />
              {formatTime(item.created_at)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
