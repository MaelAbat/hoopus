"use client";

import { useRef, useState } from "react";
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered,
  Quote, Minus, Link as LinkIcon, Image, Eye, Edit3,
} from "lucide-react";
import MarkdownContent from "./MarkdownContent";

interface MarkdownEditorProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
}

interface ToolbarAction {
  icon: React.ReactNode;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

const ACTIONS: ToolbarAction[] = [
  { icon: <Bold size={14} />, label: "Gras", prefix: "**", suffix: "**" },
  { icon: <Italic size={14} />, label: "Italique", prefix: "*", suffix: "*" },
  { icon: <Heading2 size={14} />, label: "Titre", prefix: "## ", suffix: "", block: true },
  { icon: <Heading3 size={14} />, label: "Sous-titre", prefix: "### ", suffix: "", block: true },
  { icon: <Quote size={14} />, label: "Citation", prefix: "> ", suffix: "", block: true },
  { icon: <List size={14} />, label: "Liste", prefix: "- ", suffix: "", block: true },
  { icon: <ListOrdered size={14} />, label: "Liste numerotee", prefix: "1. ", suffix: "", block: true },
  { icon: <Minus size={14} />, label: "Separateur", prefix: "\n---\n", suffix: "", block: true },
  { icon: <LinkIcon size={14} />, label: "Lien", prefix: "[", suffix: "](url)" },
  { icon: <Image size={14} />, label: "Image", prefix: "![description](", suffix: ")" },
];

export default function MarkdownEditor({ name, defaultValue = "", placeholder, rows = 12 }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [value, setValue] = useState(defaultValue);

  function applyAction(action: ToolbarAction) {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);

    let newText: string;
    let cursorPos: number;

    if (action.block && !selected) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const before = value.slice(0, lineStart);
      const after = value.slice(start);
      newText = before + action.prefix + after;
      cursorPos = lineStart + action.prefix.length;
    } else {
      const before = value.slice(0, start);
      const after = value.slice(end);
      const wrapped = action.prefix + (selected || "texte") + action.suffix;
      newText = before + wrapped + after;
      cursorPos = start + action.prefix.length + (selected ? selected.length : 5) + action.suffix.length;
    }

    setValue(newText);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursorPos, cursorPos);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-text-secondary">Contenu</label>
        <button
          type="button"
          onClick={() => setPreview(!preview)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
            preview
              ? "bg-accent/10 text-accent"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          {preview ? <Edit3 size={12} /> : <Eye size={12} />}
          {preview ? "Editer" : "Apercu"}
        </button>
      </div>

      {/* Toolbar */}
      {!preview && (
        <div className="flex flex-wrap items-center gap-0.5 rounded-t-xl border border-b-0 border-border-t bg-input/50 px-2 py-1.5">
          {ACTIONS.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applyAction(action)}
              className="rounded-md p-1.5 text-text-muted hover:bg-card hover:text-text-primary transition-colors"
              title={action.label}
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}

      {preview ? (
        <div className="min-h-[200px] rounded-xl border border-border-t bg-input/30 p-4 sm:p-6">
          {value ? (
            <MarkdownContent content={value} />
          ) : (
            <p className="text-sm text-text-faint italic">Rien a afficher</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={rows}
          className={`w-full bg-input border border-border-t px-4 py-3 text-sm text-text-primary placeholder-text-faint focus:border-accent/50 focus:outline-none transition-colors resize-y font-mono ${
            ACTIONS.length > 0 ? "rounded-b-xl" : "rounded-xl"
          }`}
          placeholder={placeholder || "Ecrivez en Markdown...\n\n## Titre\n**gras** *italique*\n- liste\n> citation"}
        />
      )}

      <p className="mt-1.5 text-[10px] text-text-faint">
        Supporte le Markdown : **gras**, *italique*, ## titres, - listes, &gt; citations, [liens](url), ![images](url), ---
      </p>
    </div>
  );
}
