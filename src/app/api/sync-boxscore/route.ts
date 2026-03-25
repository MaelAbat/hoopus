import { NextRequest, NextResponse } from "next/server";
import { syncBoxscore } from "@/lib/sync-boxscore";

export async function GET(request: NextRequest) {
  const gameId = request.nextUrl.searchParams.get("gameId");
  if (!gameId) {
    return NextResponse.json({ error: "gameId required" }, { status: 400 });
  }

  const ok = await syncBoxscore(gameId);
  if (!ok) {
    return NextResponse.json({ error: "Failed to sync boxscore" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, gameId });
}
