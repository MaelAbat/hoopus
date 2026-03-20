import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = request.nextUrl.origin;
  const headers = { authorization: `Bearer ${process.env.CRON_SECRET}` };
  const secret = `secret=${process.env.REVALIDATE_SECRET}`;

  // Sync stats, games, standings, team stats et playoffs en parallèle
  const [statsRes, gamesRes, standingsRes, teamStatsRes, playoffsRes] = await Promise.all([
    fetch(`${baseUrl}/api/sync-stats?${secret}`, { headers }),
    fetch(`${baseUrl}/api/sync-games?${secret}`, { headers }),
    fetch(`${baseUrl}/api/sync-standings?${secret}`, { headers }),
    fetch(`${baseUrl}/api/sync-team-stats?${secret}`, { headers }),
    fetch(`${baseUrl}/api/sync-playoffs?${secret}`, { headers }),
  ]);

  const [statsData, gamesData, standingsData, teamStatsData, playoffsData] = await Promise.all([
    statsRes.json(),
    gamesRes.json(),
    standingsRes.json(),
    teamStatsRes.json(),
    playoffsRes.json(),
  ]);

  // Revalidate all data-driven pages after sync
  revalidatePath("/calendrier");
  revalidatePath("/classement");
  revalidatePath("/statistiques");
  revalidatePath("/playoffs");

  return NextResponse.json({
    ok: true,
    stats: statsData,
    games: gamesData,
    standings: standingsData,
    teamStats: teamStatsData,
    playoffs: playoffsData,
    timestamp: new Date().toISOString(),
  });
}
