"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Non connecté");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) throw new Error("Accès refusé");
}

export async function triggerSync(): Promise<{
  ok: boolean;
  error?: string;
  results?: Record<string, unknown>;
}> {
  await requireAdmin();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002";

  const cronSecret = process.env.CRON_SECRET || "";
  const authParam = `cron_secret=${encodeURIComponent(cronSecret)}`;

  const endpoints = [
    { key: "stats", path: "/api/sync-stats" },
    { key: "games", path: "/api/sync-games" },
    { key: "standings", path: "/api/sync-standings" },
    { key: "teamStats", path: "/api/sync-team-stats" },
    { key: "playoffs", path: "/api/sync-playoffs" },
    { key: "rosters", path: "/api/sync-rosters" },
    { key: "players", path: "/api/sync-players" },
    { key: "career", path: "/api/sync-career" },
  ];

  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  await Promise.all(
    endpoints.map(async ({ key, path }) => {
      try {
        const res = await fetch(`${baseUrl}${path}?${authParam}`);
        results[key] = await res.json();
      } catch (e) {
        results[key] = { error: e instanceof Error ? e.message : "failed" };
        errors.push(key);
      }
    })
  );

  revalidatePath("/calendrier");
  revalidatePath("/classement");
  revalidatePath("/statistiques");
  revalidatePath("/playoffs");
  revalidatePath("/equipes");
  revalidatePath("/joueurs");

  return {
    ok: errors.length === 0,
    error: errors.length > 0 ? `Échec partiel: ${errors.join(", ")}` : undefined,
    results,
  };
}
