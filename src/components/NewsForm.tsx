"use client";

import { useRef } from "react";
import { createNews, updateNews } from "@/lib/actions/news";
import type { News } from "@/lib/types/database";
import { X } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-[#111827] border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {news ? "Modifier l'actualité" : "Nouvelle actualité"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Titre</label>
            <input
              name="title"
              defaultValue={news?.title}
              required
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none transition-colors"
              placeholder="Titre de l'actualité"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Catégorie</label>
            <select
              name="category"
              defaultValue={news?.category || "Match"}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none transition-colors"
            >
              {["Match", "Trade", "Blessure", "Draft", "Classement", "Autre"].map((cat) => (
                <option key={cat} value={cat} className="bg-[#111827]">{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Résumé</label>
            <textarea
              name="excerpt"
              defaultValue={news?.excerpt}
              required
              rows={3}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none transition-colors resize-none"
              placeholder="Résumé de l'actualité"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="featured"
              id="featured"
              defaultChecked={news?.featured}
              className="h-4 w-4 rounded border-white/10 bg-white/5 accent-orange-500"
            />
            <label htmlFor="featured" className="text-sm text-gray-400">À la une</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
            >
              {news ? "Modifier" : "Créer"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
