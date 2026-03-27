"use client";

import { useState } from "react";
import { Clock, ArrowRight, Plus, Pencil } from "lucide-react";
import Link from "next/link";
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

      {/* Featured */}
      {featured && (
        <Link href={`/actualites/${featured.id}`} className="group relative block overflow-hidden rounded-2xl border border-accent/20 transition-all duration-300 hover:border-accent/40 hover:shadow-lg">
          {featured.image_url && (
            <div className="aspect-[21/9] w-full overflow-hidden">
              <img
                src={featured.image_url}
                alt={featured.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          )}
          <div className={`p-5 sm:p-8 ${featured.image_url ? "" : "bg-gradient-to-br from-accent-light to-transparent"}`}>
            {isAdmin && (
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button onClick={(e) => { e.preventDefault(); openEdit(featured); }} className="rounded-lg p-2 bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors">
                  <Pencil size={16} />
                </button>
                <span onClick={(e) => e.preventDefault()}>
                  <DeleteButton onDelete={() => deleteNews(featured.id)} />
                </span>
              </div>
            )}
            <span className="inline-block rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-text">
              {featured.category}
            </span>
            <h2 className="mt-4 text-xl sm:text-2xl font-bold text-text-primary">{featured.title}</h2>
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
        </Link>
      )}

      {/* Empty state */}
      {news.length === 0 && (
        <div className="rounded-2xl bg-card border border-border-t p-12 sm:p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-input mb-5">
            <Clock size={28} className="text-text-faint" />
          </div>
          <p className="text-lg font-semibold text-text-primary">Aucune actualité pour l&apos;instant</p>
          <p className="mt-2 text-sm text-text-muted">Les dernières nouvelles de la NBA apparaîtront ici.</p>
        </div>
      )}

      {/* News list */}
      <div className="space-y-3">
        {others.map((item) => (
          <Link
            key={item.id}
            href={`/actualites/${item.id}`}
            className="group relative block overflow-hidden rounded-2xl bg-card border border-border-t transition-all duration-200 hover:border-border-hover hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className="flex">
              {item.image_url && (
                <div className="hidden sm:block w-40 shrink-0 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="flex-1 p-4 sm:p-6">
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={(e) => { e.preventDefault(); openEdit(item); }} className="rounded-lg p-2 text-text-faint hover:bg-input hover:text-text-primary transition-colors">
                      <Pencil size={16} />
                    </button>
                    <span onClick={(e) => e.preventDefault()}>
                      <DeleteButton onDelete={() => deleteNews(item.id)} />
                    </span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 sm:pr-16">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block rounded-full bg-input px-3 py-1 text-xs font-medium text-text-muted">
                      {item.category}
                    </span>
                    <h3 className="mt-2 sm:mt-3 text-base sm:text-lg font-semibold text-text-primary leading-snug group-hover:text-accent-text transition-colors">{item.title}</h3>
                    <p className="mt-1 text-sm text-text-muted leading-relaxed line-clamp-2">{item.excerpt}</p>
                  </div>
                  <ArrowRight size={16} className="mt-8 shrink-0 text-text-faint transition-all group-hover:translate-x-1 group-hover:text-accent hidden sm:block" />
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-text-faint">
                  <Clock size={12} />
                  {formatTime(item.created_at)}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
