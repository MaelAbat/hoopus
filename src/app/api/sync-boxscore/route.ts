import { NextRequest, NextResponse } from "next/server";
import { syncBoxscore } from "@/lib/sync-boxscore";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("cron_secret");
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gameId = request.nextUrl.searchParams.get("gameId");
  if (!gameId || !/^\d{10}$/.test(gameId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const ok = await syncBoxscore(gameId);
  if (!ok) {
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, gameId });
}
