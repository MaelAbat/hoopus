"use client";

import { useState } from "react";
import { signup } from "@/lib/actions/auth";
import Link from "next/link";
import { Trophy, UserPlus } from "lucide-react";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await signup(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080d1a]">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-[#111827] border border-white/5 p-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20">
            <Trophy size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Hoop<span className="text-orange-500">us</span>
          </h1>
          <p className="text-sm text-gray-500">Créez votre compte</p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="display_name" className="block text-sm font-medium text-gray-400 mb-2">
              Nom d&apos;affichage
            </label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              required
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50"
              placeholder="Votre pseudo"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-2">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50"
              placeholder="Minimum 6 caractères"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            <UserPlus size={16} />
            {loading ? "Création..." : "Créer un compte"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Déjà un compte ?{" "}
          <Link href="/auth/login" className="font-medium text-orange-500 hover:text-orange-400 transition-colors">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
