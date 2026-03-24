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

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3002");

  const headers: Record<string, string> = {
    authorization: `Bearer ${process.env.CRON_SECRET}`,
  };
  const secret = `secret=${process.env.REVALIDATE_SECRET}`;

  try {
    const [statsRes, gamesRes, standingsRes, teamStatsRes, playoffsRes, rostersRes, playersRes] = await Promise.all([
      fetch(`${baseUrl}/api/sync-stats?${secret}`, { headers }),
      fetch(`${baseUrl}/api/sync-games?${secret}`, { headers }),
      fetch(`${baseUrl}/api/sync-standings?${secret}`, { headers }),
      fetch(`${baseUrl}/api/sync-team-stats?${secret}`, { headers }),
      fetch(`${baseUrl}/api/sync-playoffs?${secret}`, { headers }),
      fetch(`${baseUrl}/api/sync-rosters?${secret}`, { headers }),
      fetch(`${baseUrl}/api/sync-players?${secret}`, { headers }),
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
