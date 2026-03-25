import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = request.nextUrl.origin;
  const headers = {
    authorization: `Bearer ${process.env.CRON_SECRET}`,
  };

  // Sync all data sources in parallel — auth via header only, no secrets in URL
  const [statsRes, gamesRes, standingsRes, teamStatsRes, playoffsRes, rostersRes] = await Promise.all([
    fetch(`${baseUrl}/api/sync-stats`, { headers }),
    fetch(`${baseUrl}/api/sync-games`, { headers }),
    fetch(`${baseUrl}/api/sync-standings`, { headers }),
    fetch(`${baseUrl}/api/sync-team-stats`, { headers }),
    fetch(`${baseUrl}/api/sync-playoffs`, { headers }),
    fetch(`${baseUrl}/api/sync-rosters`, { headers }),
  ]);

  const [statsData, gamesData, standingsData, teamStatsData, playoffsData, rostersData] = await Promise.all([
    statsRes.json(),
    gamesRes.json(),
    standingsRes.json(),
    teamStatsRes.json(),
    playoffsRes.json(),
    rostersRes.json(),
  ]);

  // Revalidate all data-driven pages after sync
  revalidatePath("/calendrier");
  revalidatePath("/classement");
  revalidatePath("/statistiques");
  revalidatePath("/playoffs");
  revalidatePath("/equipes");

  return NextResponse.json({
    ok: true,
    stats: statsData,
    games: gamesData,
    standings: standingsData,
    teamStats: teamStatsData,
    playoffs: playoffsData,
    rosters: rostersData,
    timestamp: new Date().toISOString(),
  });
}
