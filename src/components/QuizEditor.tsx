"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, Save, ArrowLeft, List, ListOrdered, ArrowDownUp } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  image_url?: string | null;
  image_position?: string;
}

let idCounter = 0;
function generateId() {
  return `entry-${++idCounter}`;
}

function SortableEntry({
  entry,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  entry: EntryDraft;
  index: number;
  onUpdate: (id: string, field: keyof EntryDraft, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? "relative" as const : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-entry-id={entry.id}
      className={`flex items-start gap-2 px-4 py-3 ${isDragging ? "bg-card-hover shadow-lg opacity-90" : ""}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Glisser pour réordonner"
        className="shrink-0 mt-1 -ml-1 p-1 cursor-grab active:cursor-grabbing text-text-faint hover:text-text-primary transition-colors touch-none"
      >
        <GripVertical size={18} />
      </button>

      {/* Number */}
      <span className="tnum shrink-0 flex h-7 w-7 items-center justify-center bg-input text-[11px] font-bold text-text-faint mt-1.5">
        {index + 1}
      </span>

      {/* Fields */}
      <div className="flex-1 space-y-1.5">
        <input
          type="text"
          value={entry.label}
          onChange={(e) => onUpdate(entry.id, "label", e.target.value)}
          placeholder="Indice affiché (optionnel)"
          className="w-full bg-input border border-rule px-3 py-2 text-xs text-text-primary placeholder:text-text-faint outline-none focus:border-accent transition-colors"
        />
        <input
          type="text"
          value={entry.answers}
          onChange={(e) => onUpdate(entry.id, "answers", e.target.value)}
          placeholder="Réponses acceptées, séparées par des virgules"
          className="w-full bg-input border border-rule px-3 py-2 text-xs text-text-primary placeholder:text-text-faint outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Delete */}
      <button
        onClick={() => onRemove(entry.id)}
        disabled={!canRemove}
        aria-label="Supprimer cette entrée"
        className="shrink-0 mt-1 p-2 text-text-faint hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-20"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
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
  const [imageUrl, setImageUrl] = useState(existing?.image_url || "");
  const [imagePosition, setImagePosition] = useState(existing?.image_position || "center");
  const [entries, setEntries] = useState<EntryDraft[]>(() => {
    // Use index-based IDs for deterministic SSR/client hydration
    const initial = existing?.entries.map((e, i) => ({
      id: `entry-${i + 1}`,
      label: e.label || "",
      answers: e.answers.join(", "),
    })) || [{ id: "entry-1", label: "", answers: "" }];
    idCounter = initial.length; // Sync counter so new entries get unique IDs
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const entriesEndRef = useRef<HTMLDivElement>(null);

  // Focus on newly added entry
  useEffect(() => {
    if (!lastAddedId) return;
    const el = document.querySelector(`[data-entry-id="${lastAddedId}"] input`) as HTMLInputElement;
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setLastAddedId(null);
  }, [lastAddedId]);

  function addEntry() {
    const id = generateId();
    setEntries([...entries, { id, label: "", answers: "" }]);
    setLastAddedId(id);
  }

  function removeEntry(id: string) {
    if (entries.length <= 1) return;
    setEntries(entries.filter((e) => e.id !== id));
  }

  function updateEntry(id: string, field: keyof EntryDraft, value: string) {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = entries.findIndex((e) => e.id === active.id);
      const newIndex = entries.findIndex((e) => e.id === over.id);
      setEntries(arrayMove(entries, oldIndex, newIndex));
    }
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
      image_url: imageUrl.trim() || null,
      image_position: imagePosition,
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
          className="inline-flex items-center gap-2 sm:gap-1.5 border border-rule bg-card px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:border-border-hover hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={12} /> Retour
        </Link>
        <h1 className="font-display text-2xl text-text-primary">{isEdit ? "Modifier le quiz" : "Nouveau quiz"}</h1>
      </div>

      {/* Basic info */}
      <div className="bg-card border border-rule p-5 space-y-4">
        <div>
          <label className="kicker block text-text-faint mb-1.5">Titre</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Palmarès NBA"
            className="w-full bg-input border border-rule px-3 py-2.5 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="kicker block text-text-faint mb-1.5">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Retrouve tous les champions NBA depuis 1947."
            className="w-full bg-input border border-rule px-3 py-2.5 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent transition-colors"
          />
        </div>
        <ImageUpload defaultValue={imageUrl} onChange={(url) => setImageUrl(url)} hidePreview={!!imageUrl} />
        {imageUrl && (
          <div className="space-y-2">
            <label className="kicker block text-text-faint">Cadrage de l'image</label>
            <div className="h-32 w-full overflow-hidden border border-rule">
              <img
                src={imageUrl}
                alt="Apercu cadrage"
                className="h-full w-full object-cover"
                style={{ objectPosition: `center ${imagePosition}` }}
              />
            </div>
            <div className="flex border border-rule bg-card">
              {Array.from({ length: 10 }, (_, i) => `${i * 10 + 10}%`).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setImagePosition(value)}
                  className={`tnum flex-1 py-1.5 font-mono text-[10px] transition-colors ${
                    imagePosition === value ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="kicker block text-text-faint mb-1.5">Mode</label>
            <div className="flex border border-rule bg-card">
              <button
                onClick={() => setMode("unordered")}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  mode === "unordered" ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
                }`}
              >
                <List size={13} /> Désordre
              </button>
              <button
                onClick={() => setMode("ordered")}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  mode === "ordered" ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
                }`}
              >
                <ListOrdered size={13} /> Dans l'ordre
              </button>
            </div>
          </div>
          <div>
            <label className="kicker block text-text-faint mb-1.5">Temps (minutes)</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value) || 5)}
              className="tnum w-20 bg-input border border-rule px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Entries */}
      <div className="bg-card border border-rule overflow-hidden">
        <div className="px-5 py-3 border-b border-rule flex items-center justify-between">
          <h2 className="kicker text-text-primary">
            Réponses (<span className="tnum">{entries.length}</span>)
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEntries([...entries].reverse())}
              className="inline-flex items-center gap-1 border border-rule px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:border-border-hover hover:text-text-primary transition-colors"
            >
              <ArrowDownUp size={12} /> Inverser
            </button>
            <button
              onClick={addEntry}
              className="inline-flex items-center gap-1 bg-accent px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-white hover:bg-accent-hover transition-colors"
            >
              <Plus size={12} /> Ajouter
            </button>
          </div>
        </div>

        <DndContext id="quiz-editor-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-rule">
              {entries.map((entry, i) => (
                <SortableEntry
                  key={entry.id}
                  entry={entry}
                  index={i}
                  onUpdate={updateEntry}
                  onRemove={removeEntry}
                  canRemove={entries.length > 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 px-4 py-2.5 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Actions — sticky bottom */}
      <div className="sticky bottom-0 z-40 -mx-3 sm:-mx-0 border-t border-rule bg-card">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={addEntry}
              className="inline-flex items-center gap-1.5 border border-border-hover px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-text-primary hover:bg-input transition-colors"
            >
              <Plus size={14} /> Ajouter
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-accent px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <Save size={14} /> {saving ? "Enregistrement..." : "Publier"}
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 border border-border-hover px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-text-primary hover:bg-input transition-colors disabled:opacity-50"
            >
              Brouillon
            </button>
          </div>
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 border border-red-500/40 bg-red-500/10 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} /> {deleting ? "Suppression..." : "Supprimer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
