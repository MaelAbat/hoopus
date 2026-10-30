import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBoxscore } from "@/lib/sync-boxscore";
import { isEspnGameId } from "@/lib/espn-teams";
import { fetchDayGames } from "@/lib/espn-schedule";

export const dynamic = "force-dynamic";

// Only hit the upstream source once per game per SYNC_STALE_MS window, no
// matter how many clients are polling concurrently.
const SYNC_STALE_MS = 25_000;

const SELECT = "game_id, game_date, game_time, status, status_text, home_score, away_score, updated_at";

/** Identifiant NBA (10 chiffres) ou ESPN (`E` suivi de l'identifiant ESPN). */
const GAME_ID = /^(\d{10}|E\d{6,12})$/;

/** Date et heure courantes à New York, là où le calendrier range les matchs. */
function easternNow(): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/**
 * Le match a-t-il pu commencer ? `game_time` porte l'heure de l'Est sur une date
 * fictive (« 1900-01-01T19:30:00Z »). Avant le coup d'envoi, rien ne bouge :
 * inutile d'interroger ESPN toutes les 25 secondes depuis le matin.
 */
function mayHaveStarted(g: { game_date: string; game_time: string | null }, now: { date: string; minutes: number }): boolean {
  if (g.game_date < now.date) return true;
  if (g.game_date > now.date) return false;
  const m = g.game_time?.match(/T(\d{2}):(\d{2})/);
  if (!m) return true;
  return now.minutes >= Number(m[1]) * 60 + Number(m[2]);
}

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids");
  const ids = idsParam
    ? idsParam.split(",").map((s) => s.trim()).filter((s) => GAME_ID.test(s))
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
  const isStale = (g: (typeof games)[number]) => nowMs - new Date(g.updated_at).getTime() > SYNC_STALE_MS;

  // NBA : un box score par match en cours, qui met aussi le score à jour.
  const staleNba = games.filter((g) => !isEspnGameId(g.game_id) && g.status === 2 && isStale(g));

  // ESPN : le scoreboard d'une journée donne tous ses matchs en une requête. Un
  // match encore « à venir » dont l'heure est passée est relu lui aussi — c'est
  // ainsi qu'il passe en direct sans attendre la sync suivante.
  const now = easternNow();
  const staleEspnDates = [
    ...new Set(
      games
        .filter((g) => isEspnGameId(g.game_id) && g.status !== 3 && mayHaveStarted(g, now) && isStale(g))
        .map((g) => g.game_date)
    ),
  ];

  if (staleNba.length > 0 || staleEspnDates.length > 0) {
    await Promise.all([
      ...staleNba.map((g) => syncBoxscore(g.game_id)),
      ...staleEspnDates.map(async (date) => {
        try {
          const rows = await fetchDayGames(date);
          if (rows.length > 0) await supabase.from("games").upsert(rows, { onConflict: "game_id" });
        } catch {
          // ESPN muet : on rend les scores en base, le prochain appel réessaiera.
        }
      }),
    ]);

    const refreshedIds = games
      .filter((g) => staleNba.includes(g) || staleEspnDates.includes(g.game_date))
      .map((g) => g.game_id);
    const { data: refreshed } = await supabase.from("games").select(SELECT).in("game_id", refreshedIds);
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
