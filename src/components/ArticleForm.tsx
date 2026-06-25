"use client";

import { useRef } from "react";
import { createArticle, updateArticle } from "@/lib/actions/articles";
import type { Article } from "@/lib/types/database";
import { X } from "lucide-react";
import ImageUpload from "./ImageUpload";
import MarkdownEditor from "./MarkdownEditor";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto overflow-x-hidden border border-rule bg-card p-6 sm:p-8">
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-text-primary">
            {article ? "Modifier l'article" : "Nouvel article"}
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
              defaultValue={article?.title}
              required
              className="w-full border border-rule bg-input px-4 py-2.5 text-text-primary placeholder-text-faint transition-colors focus:border-accent focus:outline-none"
              placeholder="Titre de l'article"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="kicker mb-2 block text-text-faint">Tag</label>
              <select
                name="tag"
                defaultValue={article?.tag || "Analyse"}
                className="w-full border border-rule bg-input px-4 py-2.5 text-text-primary transition-colors focus:border-accent focus:outline-none"
              >
                {["Analyse", "Histoire", "Tactique", "Portrait", "Opinion"].map((tag) => (
                  <option key={tag} value={tag} className="bg-card">{tag}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="kicker mb-2 block text-text-faint">Temps de lecture</label>
              <input
                name="read_time"
                defaultValue={article?.read_time}
                required
                className="w-full border border-rule bg-input px-4 py-2.5 text-text-primary placeholder-text-faint transition-colors focus:border-accent focus:outline-none"
                placeholder="8 min"
              />
            </div>
          </div>

          <div>
            <label className="kicker mb-2 block text-text-faint">Auteur</label>
            <input
              name="author"
              defaultValue={article?.author}
              required
              className="w-full border border-rule bg-input px-4 py-2.5 text-text-primary placeholder-text-faint transition-colors focus:border-accent focus:outline-none"
              placeholder="Nom de l'auteur"
            />
          </div>

          <ImageUpload name="image_url" defaultValue={article?.image_url} />

          <div>
            <label className="kicker mb-2 block text-text-faint">Résumé</label>
            <textarea
              name="excerpt"
              defaultValue={article?.excerpt}
              required
              rows={2}
              className="w-full resize-none border border-rule bg-input px-4 py-2.5 text-text-primary placeholder-text-faint transition-colors focus:border-accent focus:outline-none"
              placeholder="Résumé de l'article"
            />
          </div>

          <MarkdownEditor
            name="content"
            defaultValue={article?.content ?? ""}
            placeholder="Ecrivez le contenu de l'article en Markdown..."
            rows={14}
          />

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
            >
              {article ? "Modifier" : "Créer"}
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
