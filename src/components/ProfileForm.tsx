"use client";

import { useState } from "react";
import { updateProfile } from "@/lib/actions/auth";
import { Save } from "lucide-react";

export default function ProfileForm({ currentName }: { currentName: string }) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const formData = new FormData();
    formData.set("display_name", name);
    await updateProfile(formData);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-card border border-border-t p-6">
      <h3 className="text-sm font-semibold text-text-secondary mb-4">Modifier le profil</h3>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="display_name" className="block text-xs font-medium text-text-muted mb-1.5">
            Nom d&apos;affichage
          </label>
          <input
            id="display_name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-input border border-border-t px-4 py-2.5 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-accent/50"
          />
        </div>
        <button
          type="submit"
          disabled={saving || name === currentName}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? "..." : saved ? "Sauvegardé" : "Sauvegarder"}
        </button>
      </div>
    </form>
  );
}
