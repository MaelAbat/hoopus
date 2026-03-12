"use client";

import { useRef } from "react";
import { createArticle, updateArticle } from "@/lib/actions/articles";
import type { Article } from "@/lib/types/database";
import { X } from "lucide-react";

interface ArticleFormProps {
  article?: Article;
  onClose: () => void;
}

export default function ArticleForm({ article, onClose }: ArticleFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    if (article) {
      await updateArticle(article.id, formData);
    } else {
      await createArticle(formData);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111827] border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {article ? "Modifier l'article" : "Nouvel article"}
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
              defaultValue={article?.title}
              required
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none transition-colors"
              placeholder="Titre de l'article"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Tag</label>
              <select
                name="tag"
                defaultValue={article?.tag || "Analyse"}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none transition-colors"
              >
                {["Analyse", "Histoire", "Tactique", "Portrait", "Opinion"].map((tag) => (
                  <option key={tag} value={tag} className="bg-[#111827]">{tag}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Temps de lecture</label>
              <input
                name="read_time"
                defaultValue={article?.read_time}
                required
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none transition-colors"
                placeholder="8 min"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Auteur</label>
            <input
              name="author"
              defaultValue={article?.author}
              required
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none transition-colors"
              placeholder="Nom de l'auteur"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Résumé</label>
            <textarea
              name="excerpt"
              defaultValue={article?.excerpt}
              required
              rows={2}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none transition-colors resize-none"
              placeholder="Résumé de l'article"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Contenu</label>
            <textarea
              name="content"
              defaultValue={article?.content}
              rows={6}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none transition-colors resize-none"
              placeholder="Contenu complet de l'article..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
            >
              {article ? "Modifier" : "Créer"}
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
