"use client";

import { useRef } from "react";
import { createNews, updateNews } from "@/lib/actions/news";
import type { News } from "@/lib/types/database";
import { X } from "lucide-react";
import ImageUpload from "./ImageUpload";

interface NewsFormProps {
  news?: News;
  onClose: () => void;
}

export default function NewsForm({ news, onClose }: NewsFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    if (news) {
      await updateNews(news.id, formData);
    } else {
      await createNews(formData);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-lg overflow-hidden border border-rule bg-card p-6 sm:p-8">
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-text-primary">
            {news ? "Modifier l'actualité" : "Nouvelle actualité"}
          </h2>
          <button onClick={onClose} className="p-1 text-text-muted transition-colors hover:bg-input hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <form ref={formRef} action={handleSubmit} className="space-y-5">
          <div>
            <label className="kicker mb-2 block text-text-faint">Titre</label>
            <input
              name="title"
              defaultValue={news?.title}
              required
              className="w-full border border-rule bg-input px-4 py-2.5 text-text-primary placeholder-text-faint transition-colors focus:border-accent focus:outline-none"
              placeholder="Titre de l'actualité"
            />
          </div>

          <div>
            <label className="kicker mb-2 block text-text-faint">Catégorie</label>
            <select
              name="category"
              defaultValue={news?.category || "Match"}
              className="w-full border border-rule bg-input px-4 py-2.5 text-text-primary transition-colors focus:border-accent focus:outline-none"
            >
              {["Match", "Trade", "Blessure", "Draft", "Classement", "Autre"].map((cat) => (
                <option key={cat} value={cat} className="bg-card">{cat}</option>
              ))}
            </select>
          </div>

          <ImageUpload name="image_url" defaultValue={news?.image_url} />

          <div>
            <label className="kicker mb-2 block text-text-faint">Résumé</label>
            <textarea
              name="excerpt"
              defaultValue={news?.excerpt}
              required
              rows={3}
              className="w-full resize-none border border-rule bg-input px-4 py-2.5 text-text-primary placeholder-text-faint transition-colors focus:border-accent focus:outline-none"
              placeholder="Résumé de l'actualité"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="featured"
              id="featured"
              defaultChecked={news?.featured}
              className="h-4 w-4 border-rule bg-input accent-accent"
            />
            <label htmlFor="featured" className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">À la une</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
            >
              {news ? "Modifier" : "Créer"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border border-border-hover px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-text-primary transition-colors hover:bg-input"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
