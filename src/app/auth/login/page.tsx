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
      className="flex w-full items-center justify-center gap-2 bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-80"
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
    <div className="relative w-full max-w-md overflow-hidden border border-rule bg-card p-6 sm:p-8">
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
      {/* Logo */}
      <div className="space-y-2">
        <h1 className="font-display text-3xl tracking-tight text-text-primary">
          HOOP<span className="text-accent">US</span>
        </h1>
        <p className="kicker text-text-faint">Connectez-vous à votre compte</p>
      </div>

      {error && (
        <div className="relative mt-6 border border-rule bg-card py-3 pl-4 pr-4 text-sm text-text-primary">
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
          {error}
        </div>
      )}

      <form action={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="kicker mb-2 block text-text-faint">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full border border-rule bg-input px-4 py-3 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-accent"
            placeholder="votre@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="kicker mb-2 block text-text-faint">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full border border-rule bg-input px-4 py-3 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-accent"
            placeholder="••••••••"
          />
          <p className="mt-2 text-xs text-text-muted">
            Les nouveaux comptes exigent 8+ caractères avec majuscule, minuscule, chiffre et symbole.
          </p>
        </div>

        <SubmitButton />
      </form>

      <p className="mt-8 text-center text-sm text-text-muted">
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
