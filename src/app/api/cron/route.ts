import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = request.nextUrl.origin;
  const headers = { authorization: `Bearer ${process.env.CRON_SECRET}` };
  const secret = `secret=${process.env.REVALIDATE_SECRET}`;

  // Sync stats et games en parallèle
  const [statsRes, gamesRes] = await Promise.all([
    fetch(`${baseUrl}/api/sync-stats?${secret}`, { headers }),
    fetch(`${baseUrl}/api/sync-games?${secret}`, { headers }),
  ]);

  const [statsData, gamesData] = await Promise.all([
    statsRes.json(),
    gamesRes.json(),
  ]);

  return NextResponse.json({
    ok: true,
    stats: statsData,
    games: gamesData,
    timestamp: new Date().toISOString(),
  });
}
