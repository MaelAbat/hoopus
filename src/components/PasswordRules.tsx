"use client";

import { Check, Circle } from "lucide-react";

type Rule = {
  label: string;
  test: (pwd: string) => boolean;
};

const RULES: Rule[] = [
  { label: "Au moins 8 caractères", test: (p) => p.length >= 8 },
  { label: "Une lettre minuscule", test: (p) => /[a-z]/.test(p) },
  { label: "Une lettre majuscule", test: (p) => /[A-Z]/.test(p) },
  { label: "Un chiffre", test: (p) => /\d/.test(p) },
  { label: "Un symbole (ex. ! @ # $)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function isPasswordValid(password: string): boolean {
  return RULES.every((r) => r.test(password));
}

export const PASSWORD_PATTERN =
  "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$";

type Props = {
  password?: string;
  live?: boolean;
};

export default function PasswordRules({ password = "", live = false }: Props) {
  return (
    <ul className="mt-2 space-y-1 text-xs" aria-label="Exigences du mot de passe">
      {RULES.map((rule) => {
        const met = live && rule.test(password);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-2 transition-colors ${
              met ? "text-emerald-400" : "text-text-muted"
            }`}
          >
            {met ? <Check size={12} strokeWidth={3} /> : <Circle size={10} />}
            <span>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
