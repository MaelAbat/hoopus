"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, Save, ArrowLeft, List, ListOrdered } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface EntryDraft {
  id: string;
  label: string;
  answers: string;
}

interface ExistingQuiz {
  id: string;
  title: string;
  description: string;
  mode: string;
  time_limit: number;
  entries: { label: string; answers: string[] }[];
  published: boolean;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function QuizEditor({ existing }: { existing?: ExistingQuiz }) {
  const router = useRouter();
  const isEdit = !!existing;

  const [title, setTitle] = useState(existing?.title || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [mode, setMode] = useState<"unordered" | "ordered">(
    (existing?.mode as "unordered" | "ordered") || "unordered"
  );
  const [timeLimit, setTimeLimit] = useState(existing ? Math.round(existing.time_limit / 60) : 5);
  const [entries, setEntries] = useState<EntryDraft[]>(
    existing?.entries.map((e) => ({
      id: generateId(),
      label: e.label || "",
      answers: e.answers.join(", "),
    })) || [{ id: generateId(), label: "", answers: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  function addEntry() {
    setEntries([...entries, { id: generateId(), label: "", answers: "" }]);
  }

  function removeEntry(id: string) {
    if (entries.length <= 1) return;
    setEntries(entries.filter((e) => e.id !== id));
  }

  function updateEntry(id: string, field: keyof EntryDraft, value: string) {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  }

  function moveEntry(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= entries.length) return;
    const newEntries = [...entries];
    [newEntries[index], newEntries[newIndex]] = [newEntries[newIndex], newEntries[index]];
    setEntries(newEntries);
  }

  async function handleSave(publish: boolean) {
    setError("");

    if (!title.trim()) {
      setError("Le titre est requis.");
      return;
    }

    // Only answers are required, label is optional
    const validEntries = entries.filter((e) => e.answers.trim());
    if (validEntries.length < 2) {
      setError("Il faut au moins 2 réponses.");
      return;
    }

    setSaving(true);

    const formattedEntries = validEntries.map((e) => ({
      label: e.label.trim(),
      answers: e.answers.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean),
    }));

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      title: title.trim(),
      description: description.trim(),
      mode,
      time_limit: timeLimit * 60,
      entries: formattedEntries,
      published: publish,
      updated_at: new Date().toISOString(),
    };

    let dbError;
    if (isEdit) {
      ({ error: dbError } = await supabase.from("quizzes").update(payload).eq("id", existing.id));
    } else {
      ({ error: dbError } = await supabase.from("quizzes").insert({ ...payload, created_by: user?.id }));
    }

    setSaving(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    router.push("/mini-jeux/hoopiz");
    router.refresh();
  }

  async function handleDelete() {
    if (!existing || !confirm("Supprimer ce quiz définitivement ?")) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("quizzes").delete().eq("id", existing.id);
    router.push("/mini-jeux/hoopiz");
    router.refresh();
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/mini-jeux/hoopiz"
          className="inline-flex items-center gap-1.5 rounded-lg bg-input px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
        >
          <ArrowLeft size={12} /> Retour
        </Link>
        <h1 className="text-xl font-bold text-text-primary">{isEdit ? "Modifier le quiz" : "Nouveau quiz"}</h1>
      </div>

      {/* Basic info */}
      <div className="rounded-2xl bg-card border border-border-t p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Titre</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Palmarès NBA"
            className="w-full rounded-lg bg-sidebar border border-border-t px-3 py-2.5 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Retrouve tous les champions NBA depuis 1947."
            className="w-full rounded-lg bg-sidebar border border-border-t px-3 py-2.5 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Mode</label>
            <div className="flex rounded-lg bg-input p-0.5">
              <button
                onClick={() => setMode("unordered")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  mode === "unordered" ? "bg-card text-text-primary shadow-sm" : "text-text-muted"
                }`}
              >
                <List size={13} /> Désordre
              </button>
              <button
                onClick={() => setMode("ordered")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  mode === "ordered" ? "bg-card text-text-primary shadow-sm" : "text-text-muted"
                }`}
              >
                <ListOrdered size={13} /> Dans l'ordre
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Temps (minutes)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value) || 5)}
              className="w-20 rounded-lg bg-sidebar border border-border-t px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* Entries */}
      <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
        <div className="px-5 py-3 border-b border-border-t flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-primary">
            Réponses ({entries.length})
          </h2>
          <button
            onClick={addEntry}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-hover transition-colors"
          >
            <Plus size={12} /> Ajouter
          </button>
        </div>

        <div className="divide-y divide-border-t/30">
          {entries.map((entry, i) => (
            <div key={entry.id} className="flex items-start gap-2 px-4 py-3">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 pt-2">
                <button
                  onClick={() => moveEntry(i, -1)}
                  disabled={i === 0}
                  className="text-text-faint hover:text-text-primary disabled:opacity-20 transition-colors"
                >
                  <GripVertical size={14} />
                </button>
              </div>

              {/* Number */}
              <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md bg-input text-[11px] font-bold text-text-faint mt-1.5">
                {i + 1}
              </span>

              {/* Fields */}
              <div className="flex-1 space-y-1.5">
                <input
                  type="text"
                  value={entry.label}
                  onChange={(e) => updateEntry(entry.id, "label", e.target.value)}
                  placeholder="Indice affiché (optionnel)"
                  className="w-full rounded-lg bg-sidebar border border-border-t px-3 py-2 text-xs text-text-primary placeholder:text-text-faint outline-none focus:border-accent"
                />
                <input
                  type="text"
                  value={entry.answers}
                  onChange={(e) => updateEntry(entry.id, "answers", e.target.value)}
                  placeholder="Réponses acceptées, séparées par des virgules"
                  className="w-full rounded-lg bg-sidebar border border-border-t px-3 py-2 text-xs text-text-primary placeholder:text-text-faint outline-none focus:border-accent"
                />
              </div>

              {/* Delete */}
              <button
                onClick={() => removeEntry(entry.id)}
                className="shrink-0 mt-1.5 p-1.5 rounded-lg text-text-faint hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "Enregistrement..." : "Publier"}
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-input border border-border-t px-5 py-2.5 text-sm font-bold text-text-primary hover:bg-card-hover transition-colors disabled:opacity-50"
          >
            Brouillon
          </button>
        </div>
        {isEdit && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-5 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} /> {deleting ? "Suppression..." : "Supprimer"}
          </button>
        )}
      </div>
    </div>
  );
}
