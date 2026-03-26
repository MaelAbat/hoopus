import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  const querySecret = request.nextUrl.searchParams.get("cron_secret");
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = request.nextUrl.origin;
  const cronSecret = process.env.CRON_SECRET || "";
  const authParam = `cron_secret=${encodeURIComponent(cronSecret)}`;

  // Sync all data sources in parallel
  const [statsRes, gamesRes, standingsRes, teamStatsRes, playoffsRes, rostersRes] = await Promise.all([
    fetch(`${baseUrl}/api/sync-stats?${authParam}`),
    fetch(`${baseUrl}/api/sync-games?${authParam}`),
    fetch(`${baseUrl}/api/sync-standings?${authParam}`),
    fetch(`${baseUrl}/api/sync-team-stats?${authParam}`),
    fetch(`${baseUrl}/api/sync-playoffs?${authParam}`),
    fetch(`${baseUrl}/api/sync-rosters?${authParam}`),
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
