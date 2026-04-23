"use client";

import { Suspense, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/actions/auth";
import Link from "next/link";
import { LogIn, Loader2 } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
      {pending ? "Connexion en cours…" : "Se connecter"}
    </button>
  );
}

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "";

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (redirectTo) formData.set("redirectTo", redirectTo);
    const result = await login(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="w-full max-w-md space-y-8 rounded-2xl bg-card border border-border-t p-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">
          Hoop<span className="text-accent">us</span>
        </h1>
        <p className="text-sm text-text-muted">Connectez-vous à votre compte</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-muted mb-2">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
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
            autoComplete="current-password"
            className="w-full rounded-xl bg-input border border-border-t px-4 py-3 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
            placeholder="••••••••"
          />
          <p className="mt-2 text-xs text-text-muted">
            Les nouveaux comptes exigent 8+ caractères avec majuscule, minuscule, chiffre et symbole.
          </p>
        </div>

        <SubmitButton />
      </form>

      <p className="text-center text-sm text-text-muted">
        Pas encore de compte ?{" "}
        <Link href={`/auth/signup${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`} className="font-medium text-accent hover:text-accent-hover transition-colors">
          S&apos;inscrire
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
