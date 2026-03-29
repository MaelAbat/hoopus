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

  console.log(`[CRON] Sync started at ${new Date().toISOString()}`);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002";
  const cronSecret = process.env.CRON_SECRET || "";
  const authParam = `cron_secret=${encodeURIComponent(cronSecret)}`;

  // Sync non-NBA-stats sources in parallel (CDN/ESPN — no rate limit)
  const [gamesRes, standingsRes, playoffsRes] = await Promise.all([
    fetch(`${baseUrl}/api/sync-games?${authParam}`),
    fetch(`${baseUrl}/api/sync-standings?${authParam}`),
    fetch(`${baseUrl}/api/sync-playoffs?${authParam}`),
  ]);

  // Sync stats.nba.com sources sequentially to avoid rate limiting
  const statsRes = await fetch(`${baseUrl}/api/sync-stats?${authParam}`);
  const teamStatsRes = await fetch(`${baseUrl}/api/sync-team-stats?${authParam}`);
  const rostersRes = await fetch(`${baseUrl}/api/sync-rosters?${authParam}`);

  const [gamesData, standingsData, playoffsData, statsData, teamStatsData, rostersData] = await Promise.all([
    gamesRes.json(),
    standingsRes.json(),
    playoffsRes.json(),
    statsRes.json(),
    teamStatsRes.json(),
    rostersRes.json(),
  ]);

  // Revalidate all data-driven pages after sync
  revalidatePath("/calendrier");
  revalidatePath("/classement");
  revalidatePath("/statistiques");
  revalidatePath("/playoffs");
  revalidatePath("/equipes");

  const results = {
    ok: true,
    stats: statsData,
    games: gamesData,
    standings: standingsData,
    teamStats: teamStatsData,
    playoffs: playoffsData,
    rosters: rostersData,
    timestamp: new Date().toISOString(),
  };

  console.log(`[CRON] Sync completed at ${results.timestamp}`);
  console.log(`[CRON] Results:`, JSON.stringify({
    stats: statsData.ok ?? statsData.error,
    games: gamesData.ok ?? gamesData.error,
    standings: standingsData.ok ?? standingsData.error,
    teamStats: teamStatsData.ok ?? teamStatsData.error,
    playoffs: playoffsData.ok ?? playoffsData.error,
    rosters: rostersData.ok ?? rostersData.error,
  }));

  return NextResponse.json(results);
}
