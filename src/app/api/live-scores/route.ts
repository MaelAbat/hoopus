import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBoxscore } from "@/lib/sync-boxscore";

export const dynamic = "force-dynamic";

// Only hit the NBA CDN once per game per SYNC_STALE_MS window, no matter
// how many clients are polling concurrently.
const SYNC_STALE_MS = 25_000;

const SELECT = "game_id, status, status_text, home_score, away_score, updated_at";

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids");
  const ids = idsParam
    ? idsParam.split(",").map((s) => s.trim()).filter((s) => /^\d{10}$/.test(s))
    : null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const query =
    ids && ids.length > 0
      ? supabase.from("games").select(SELECT).in("game_id", ids)
      : supabase.from("games").select(SELECT).eq("status", 2);

  const { data } = await query;
  let games = data || [];

  const nowMs = Date.now();
  const stale = games.filter(
    (g) => g.status === 2 && nowMs - new Date(g.updated_at).getTime() > SYNC_STALE_MS
  );

  if (stale.length > 0) {
    await Promise.all(stale.map((g) => syncBoxscore(g.game_id)));
    const { data: refreshed } = await supabase
      .from("games")
      .select(SELECT)
      .in(
        "game_id",
        stale.map((g) => g.game_id)
      );
    const map = new Map((refreshed || []).map((g) => [g.game_id, g]));
    games = games.map((g) => map.get(g.game_id) ?? g);
  }

  return NextResponse.json(
    {
      games: games.map((g) => ({
        game_id: g.game_id,
        status: g.status,
        status_text: g.status_text,
        home_score: g.home_score,
        away_score: g.away_score,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
