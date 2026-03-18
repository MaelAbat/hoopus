import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = request.nextUrl.origin;
  const headers = { authorization: `Bearer ${process.env.CRON_SECRET}` };
  const secret = `secret=${process.env.REVALIDATE_SECRET}`;

  // Sync stats, games et standings en parallèle
  const [statsRes, gamesRes, standingsRes] = await Promise.all([
    fetch(`${baseUrl}/api/sync-stats?${secret}`, { headers }),
    fetch(`${baseUrl}/api/sync-games?${secret}`, { headers }),
    fetch(`${baseUrl}/api/sync-standings?${secret}`, { headers }),
  ]);

  const [statsData, gamesData, standingsData] = await Promise.all([
    statsRes.json(),
    gamesRes.json(),
    standingsRes.json(),
  ]);

  return NextResponse.json({
    ok: true,
    stats: statsData,
    games: gamesData,
    standings: standingsData,
    timestamp: new Date().toISOString(),
  });
}
