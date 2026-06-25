"use client";

import { useRef, useState } from "react";
import { Upload, Link as LinkIcon, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ImageUploadProps {
  name?: string;
  defaultValue?: string | null;
  onChange?: (url: string) => void;
  hidePreview?: boolean;
}

export default function ImageUpload({ name, defaultValue, onChange, hidePreview }: ImageUploadProps) {
  const [mode, setMode] = useState<"url" | "file">(defaultValue ? "url" : "url");
  const [imageUrl, setImageUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit être une image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 5 Mo");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, file, { cacheControl: "31536000", upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("media")
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      onChange?.(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setImageUrl("");
    setError("");
    onChange?.("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <label className="kicker mb-2 block text-text-faint">Image</label>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
            mode === "url"
              ? "border-accent bg-accent text-white"
              : "border-rule text-text-muted hover:border-border-hover hover:text-text-primary"
          }`}
        >
          <LinkIcon size={12} />
          URL
        </button>
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
            mode === "file"
              ? "border-accent bg-accent text-white"
              : "border-rule text-text-muted hover:border-border-hover hover:text-text-primary"
          }`}
        >
          <Upload size={12} />
          Importer
        </button>
      </div>

      {/* Hidden input that carries the final URL to the form */}
      <input type="hidden" name={name} value={imageUrl} />

      {mode === "url" ? (
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => { setImageUrl(e.target.value); onChange?.(e.target.value); }}
          className="w-full border border-rule bg-input px-4 py-2.5 text-text-primary placeholder-text-faint transition-colors focus:border-accent focus:outline-none"
          placeholder="https://exemple.com/image.jpg"
        />
      ) : (
        <div
          className={`relative border border-dashed px-4 py-6 text-center transition-colors ${
            uploading ? "border-accent bg-accent-light" : "border-rule hover:border-border-hover"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={uploading}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider text-accent-text">
              <Loader2 size={16} className="animate-spin" />
              Upload en cours...
            </div>
          ) : (
            <div>
              <Upload size={20} className="mx-auto text-text-faint" />
              <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-text-muted">
                Cliquez ou glissez une image ici
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-text-faint">PNG, JPG, WebP — 5 Mo max</p>
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {imageUrl && !hidePreview && (
        <div className="mt-2 relative group">
          <img
            src={imageUrl}
            alt="Aperçu"
            className="h-24 w-full border border-rule object-cover"
            onError={() => setError("Impossible de charger l'image")}
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute top-1 right-1 bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {error && (
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-red-500">{error}</p>
      )}
    </div>
  );
}
