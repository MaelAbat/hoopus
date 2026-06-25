"use client";

import { Suspense, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { signup } from "@/lib/actions/auth";
import Link from "next/link";
import { UserPlus, Loader2 } from "lucide-react";
import PasswordRules, { isPasswordValid, PASSWORD_PATTERN } from "@/components/PasswordRules";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex w-full items-center justify-center gap-2 bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
      {pending ? "Création du compte…" : "Créer un compte"}
    </button>
  );
}

function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "";

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (!isPasswordValid(password)) {
      setError("Le mot de passe ne respecte pas toutes les exigences.");
      return;
    }
    if (redirectTo) formData.set("redirectTo", redirectTo);
    // Clean anonymous name before upgrade (redirect on success prevents cleanup after)
    localStorage.removeItem("hoop-anonymous-name");
    const result = await signup(formData);
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
        <p className="kicker text-text-faint">Créez votre compte</p>
      </div>

      {error && (
        <div className="relative mt-6 border border-rule bg-card py-3 pl-4 pr-4 text-sm text-text-primary">
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
          {error}
        </div>
      )}

      <form action={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="display_name" className="kicker mb-2 block text-text-faint">
            Nom d&apos;affichage
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            required
            maxLength={40}
            autoComplete="username"
            className="w-full border border-rule bg-input px-4 py-3 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-accent"
            placeholder="Votre pseudo"
          />
        </div>

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
            minLength={8}
            pattern={PASSWORD_PATTERN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full border border-rule bg-input px-4 py-3 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-accent"
            placeholder="Votre mot de passe"
            aria-describedby="password-rules"
          />
          <div id="password-rules">
            <PasswordRules password={password} live />
          </div>
        </div>

        <SubmitButton />
      </form>

      <p className="mt-8 text-center text-sm text-text-muted">
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
