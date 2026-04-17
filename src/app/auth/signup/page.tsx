"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signup } from "@/lib/actions/auth";
import Link from "next/link";
import { UserPlus } from "lucide-react";

function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "";

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    if (redirectTo) formData.set("redirectTo", redirectTo);
    // Clean anonymous name before upgrade (redirect on success prevents cleanup after)
    localStorage.removeItem("hoop-anonymous-name");
    const result = await signup(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-8 rounded-2xl bg-card border border-border-t p-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">
          Hoop<span className="text-accent">us</span>
        </h1>
        <p className="text-sm text-text-muted">Créez votre compte</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="display_name" className="block text-sm font-medium text-text-muted mb-2">
            Nom d&apos;affichage
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            required
            className="w-full rounded-xl bg-input border border-border-t px-4 py-3 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
            placeholder="Votre pseudo"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-muted mb-2">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-xl bg-input border border-border-t px-4 py-3 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
            placeholder="votre@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-text-muted mb-2">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-xl bg-input border border-border-t px-4 py-3 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
            placeholder="Minimum 6 caractères"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          <UserPlus size={16} />
          {loading ? "Création..." : "Créer un compte"}
        </button>
      </form>

      <p className="text-center text-sm text-text-muted">
        Déjà un compte ?{" "}
        <Link href={`/auth/login${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`} className="font-medium text-accent hover:text-accent-hover transition-colors">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <Suspense>
        <SignupForm />
      </Suspense>
    </div>
  );
}
