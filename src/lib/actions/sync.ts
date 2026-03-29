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

export async function syncEndpoint(endpointKey: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  await requireAdmin();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002";
  const cronSecret = process.env.CRON_SECRET || "";
  const authParam = `cron_secret=${encodeURIComponent(cronSecret)}`;

  try {
    const res = await fetch(`${baseUrl}/api/sync-${endpointKey}?${authParam}`);
    const data = await res.json();

    revalidatePath("/calendrier");
    revalidatePath("/classement");
    revalidatePath("/statistiques");
    revalidatePath("/playoffs");
    revalidatePath("/equipes");
    revalidatePath("/joueurs");

    return { ok: res.ok, error: data.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}
