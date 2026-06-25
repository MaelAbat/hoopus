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
            className="inline-flex items-center gap-2 bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} />
            Ajouter
          </button>
        </div>
      )}

      {/* Featured */}
      {featured && (
        <Link href={`/actualites/${featured.id}`} className="group relative block overflow-hidden border border-rule bg-card transition-colors hover:border-border-hover">
          <span className="absolute left-0 top-0 bottom-0 z-10 w-1 bg-accent" />
          {featured.image_url && (
            <div className="relative aspect-[21/9] w-full overflow-hidden bg-input">
              <img
                src={featured.image_url}
                alt={featured.title}
                className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent mix-blend-multiply" />
              <span className="absolute left-0 top-0 bg-accent px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
                {featured.category}
              </span>
            </div>
          )}
          <div className="p-5 sm:p-8">
            {isAdmin && (
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button onClick={(e) => { e.preventDefault(); openEdit(featured); }} className="p-2 bg-black/50 text-white hover:bg-black/70 transition-colors">
                  <Pencil size={16} />
                </button>
                <span onClick={(e) => e.preventDefault()}>
                  <DeleteButton onDelete={() => deleteNews(featured.id)} />
                </span>
              </div>
            )}
            {!featured.image_url && (
              <span className="inline-block bg-accent px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
                {featured.category}
              </span>
            )}
            <h2 className={`font-display text-2xl sm:text-3xl leading-[1.05] text-text-primary transition-colors group-hover:text-accent-text ${featured.image_url ? "" : "mt-4"}`}>{featured.title}</h2>
            <p className="mt-3 text-text-secondary leading-relaxed">{featured.excerpt}</p>
            <div className="mt-5 flex items-center justify-between border-t border-rule pt-4">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-text-muted">
                <Clock size={13} />
                <span className="tnum">{formatTime(featured.created_at)}</span>
              </div>
              <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-accent-text">
                Lire la suite <ArrowRight size={14} />
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* Empty state */}
      {news.length === 0 && (
        <div className="border border-rule bg-card p-12 sm:p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center bg-input mb-5">
            <Clock size={28} className="text-text-faint" />
          </div>
          <p className="font-display text-2xl text-text-primary">Aucune actualité pour l&apos;instant</p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-text-muted">Les dernières nouvelles de la NBA apparaîtront ici.</p>
        </div>
      )}

      {/* News list */}
      <div className="border-t border-rule">
        {others.map((item) => (
          <Link
            key={item.id}
            href={`/actualites/${item.id}`}
            className="group relative block overflow-hidden border-b border-rule bg-card transition-colors hover:bg-card-hover"
          >
            <div className="flex">
              {item.image_url && (
                <div className="hidden sm:block w-40 shrink-0 overflow-hidden bg-input">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-[1.03]"
                  />
                </div>
              )}
              <div className="flex-1 p-4 sm:p-6">
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={(e) => { e.preventDefault(); openEdit(item); }} className="p-2 text-text-faint hover:bg-input hover:text-text-primary transition-colors">
                      <Pencil size={16} />
                    </button>
                    <span onClick={(e) => e.preventDefault()}>
                      <DeleteButton onDelete={() => deleteNews(item.id)} />
                    </span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 sm:pr-16">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block border border-rule px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {item.category}
                    </span>
                    <h3 className="mt-2 sm:mt-3 font-display text-lg sm:text-xl leading-snug text-text-primary group-hover:text-accent-text transition-colors">{item.title}</h3>
                    <p className="mt-1.5 text-sm text-text-muted leading-relaxed line-clamp-2">{item.excerpt}</p>
                  </div>
                  <ArrowRight size={16} className="mt-8 shrink-0 text-text-faint transition-all group-hover:translate-x-1 group-hover:text-accent hidden sm:block" />
                </div>
                <div className="mt-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-text-faint">
                  <Clock size={12} />
                  <span className="tnum">{formatTime(item.created_at)}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
