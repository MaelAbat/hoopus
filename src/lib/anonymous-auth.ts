import { SupabaseClient } from "@supabase/supabase-js";

const ANON_NAME_KEY = "hoop-anonymous-name";

const ADJECTIVES = [
  "Phantom", "Shadow", "Stealth", "Ghost", "Silent",
  "Swift", "Clutch", "Mystic", "Rogue", "Cosmic",
  "Thunder", "Blaze", "Turbo", "Neon", "Hyper",
];

const NOUNS = [
  "Dunk", "Swish", "Rebound", "Assist", "Block",
  "Steal", "Buzzer", "Layup", "Fadeaway", "Alley-Oop",
  "Crossover", "Stepback", "Fastbreak", "Floater", "Slam",
];

function generateAnonymousName(): string {
  const stored = typeof window !== "undefined" ? localStorage.getItem(ANON_NAME_KEY) : null;
  if (stored) return stored;

  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  const name = `${adj}${noun}${num}`;

  if (typeof window !== "undefined") {
    localStorage.setItem(ANON_NAME_KEY, name);
  }
  return name;
}

/**
 * Ensures a user is authenticated (real or anonymous).
 * If no session exists, signs in anonymously with a random NBA-themed pseudonym.
 * Returns the user ID or null on failure.
 */
export async function ensureAuth(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user.id;

  const displayName = generateAnonymousName();
  const { data, error } = await supabase.auth.signInAnonymously({
    options: { data: { display_name: displayName } },
  });

  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * Returns the display name for a user.
 * Falls back to the locally stored anonymous name if the profile has no meaningful display_name.
 */
const ANON_PATTERN = new RegExp(
  `^(${ADJECTIVES.join("|")})(${NOUNS.join("|")})\\d{1,2}$`
);

/**
 * Returns true if the display name matches the anonymous name pattern.
 */
export function isAnonymousName(name: string): boolean {
  return ANON_PATTERN.test(name);
}

/**
 * Returns the display name for a user.
 * Falls back to the locally stored anonymous name if the profile has no meaningful display_name.
 */
export async function getDisplayName(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  const name = profile?.display_name?.trim();
  if (name && name !== "Utilisateur" && name !== "Joueur anonyme") {
    return name;
  }
  return generateAnonymousName();
}
