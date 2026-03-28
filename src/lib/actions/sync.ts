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

  const baseUrl = process.env.INTERNAL_URL || "http://localhost:10000";

  const cronSecret = process.env.CRON_SECRET || "";
  const authParam = `cron_secret=${encodeURIComponent(cronSecret)}`;

  try {
    const [statsRes, gamesRes, standingsRes, teamStatsRes, playoffsRes, rostersRes, playersRes] = await Promise.all([
      fetch(`${baseUrl}/api/sync-stats?${authParam}`),
      fetch(`${baseUrl}/api/sync-games?${authParam}`),
      fetch(`${baseUrl}/api/sync-standings?${authParam}`),
      fetch(`${baseUrl}/api/sync-team-stats?${authParam}`),
      fetch(`${baseUrl}/api/sync-playoffs?${authParam}`),
      fetch(`${baseUrl}/api/sync-rosters?${authParam}`),
      fetch(`${baseUrl}/api/sync-players?${authParam}`),
    ]);

    const [statsData, gamesData, standingsData, teamStatsData, playoffsData, rostersData, playersData] =
      await Promise.all([
        statsRes.json(),
        gamesRes.json(),
        standingsRes.json(),
        teamStatsRes.json(),
        playoffsRes.json(),
        rostersRes.json(),
        playersRes.json(),
      ]);

    revalidatePath("/calendrier");
    revalidatePath("/classement");
    revalidatePath("/statistiques");
    revalidatePath("/playoffs");
    revalidatePath("/equipes");
    revalidatePath("/joueurs");

    return {
      ok: true,
      results: {
        stats: statsData,
        games: gamesData,
        standings: standingsData,
        teamStats: teamStatsData,
        playoffs: playoffsData,
        rosters: rostersData,
        players: playersData,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erreur lors de la synchronisation",
    };
  }
}
