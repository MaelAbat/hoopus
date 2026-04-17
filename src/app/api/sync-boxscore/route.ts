import { NextRequest, NextResponse } from "next/server";
import { syncBoxscore } from "@/lib/sync-boxscore";
import { isCronAuthorized } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
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
