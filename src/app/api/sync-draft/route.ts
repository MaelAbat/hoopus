import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { fetchLeagueState } from "@/lib/league-season";
import { isCronAuthorized } from "@/lib/cron-auth";
import { draftYearForSeason, syncDraftYear } from "@/lib/market-sync";

/**
 * Draft de la saison courante, et grille de loterie qui l'a précédée.
 *
 * Une seule page à lire. Elle n'existe qu'à partir du soir de la draft : d'ici là
 * la lecture ne renvoie rien, ce qui n'est pas une erreur. Le paramètre `year`
 * permet de rejouer une année précise à la main.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const requested = Number(request.nextUrl.searchParams.get("year"));
    const draftYear = Number.isFinite(requested) && requested > 1946
      ? requested
      : draftYearForSeason((await fetchLeagueState()).currentSeason);

    const result = await syncDraftYear(supabase, draftYear, (message) =>
      console.log(`[SYNC-DRAFT] ${message}`)
    );

    revalidatePath("/draft");
    revalidatePath(`/draft/${result.season}`);
    revalidatePath("/marche");

    console.log(
      `[SYNC-DRAFT] Draft ${draftYear} : ${result.picks} choix, ` +
        `${result.playersResolved} joueurs reliés, ${result.collegesFilled} clubs complétés, ` +
        `${result.lotteryTeams} équipes en loterie`
    );

    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[SYNC-DRAFT] Erreur:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
