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
    <form onSubmit={handleSubmit} className="border border-rule bg-card p-6">
      <h3 className="kicker mb-4 text-text-faint">Modifier le profil</h3>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="display_name" className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-text-muted">
            Nom d&apos;affichage
          </label>
          <input
            id="display_name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-rule bg-input px-4 py-2.5 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={saving || name === currentName}
          className="flex items-center justify-center gap-2 bg-accent px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? "..." : saved ? "Sauvegardé" : "Sauvegarder"}
        </button>
      </div>
    </form>
  );
}
