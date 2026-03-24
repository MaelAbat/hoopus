"use client";

import { useRef, useState } from "react";
import { Upload, Link as LinkIcon, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ImageUploadProps {
  name: string;
  defaultValue?: string | null;
}

export default function ImageUpload({ name, defaultValue }: ImageUploadProps) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setImageUrl("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-1">Image</label>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
            mode === "url"
              ? "bg-accent text-white"
              : "bg-input text-text-muted hover:text-text-primary"
          }`}
        >
          <LinkIcon size={12} />
          URL
        </button>
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
            mode === "file"
              ? "bg-accent text-white"
              : "bg-input text-text-muted hover:text-text-primary"
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
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full rounded-xl bg-input border border-border-t px-4 py-2.5 text-text-primary placeholder-text-faint focus:border-accent/50 focus:outline-none transition-colors"
          placeholder="https://exemple.com/image.jpg"
        />
      ) : (
        <div
          className={`relative rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            uploading ? "border-accent/30 bg-accent-light" : "border-border-t hover:border-border-hover"
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
            <div className="flex items-center justify-center gap-2 text-sm text-accent">
              <Loader2 size={16} className="animate-spin" />
              Upload en cours...
            </div>
          ) : (
            <div>
              <Upload size={20} className="mx-auto text-text-faint" />
              <p className="mt-1 text-xs text-text-muted">
                Cliquez ou glissez une image ici
              </p>
              <p className="text-[10px] text-text-faint">PNG, JPG, WebP — 5 Mo max</p>
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {imageUrl && (
        <div className="mt-2 relative group">
          <img
            src={imageUrl}
            alt="Aperçu"
            className="h-24 w-full rounded-lg object-cover border border-border-t"
            onError={() => setError("Impossible de charger l'image")}
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
