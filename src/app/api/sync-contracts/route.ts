import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { fetchLeagueState } from "@/lib/league-season";
import { isCronAuthorized } from "@/lib/cron-auth";
import { syncContracts } from "@/lib/market-sync";

/**
 * Termes des contrats en cours, par rotation d'équipes.
 *
 * Aucune source de transactions ne chiffre ses lignes : les montants viennent des
 * pages de contrats de Basketball Reference, une par équipe. Trente pages à 3,2 s
 * dépasseraient la minute allouée, d'où la rotation — douze équipes par passage,
 * les moins fraîches d'abord, couverture complète en trois jours.
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
    const season = (await fetchLeagueState()).currentSeason;
    const requested = Number(request.nextUrl.searchParams.get("teams"));
    const teamsPerRun = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 30) : 12;

    const result = await syncContracts(supabase, season, {
      teamsPerRun,
      log: (message) => console.log(`[SYNC-CONTRACTS] ${message}`),
    });

    revalidatePath("/marche");
    revalidatePath("/equipes");

    console.log(
      `[SYNC-CONTRACTS] ${result.contracts} contrats sur ${result.teamsRead.length} équipe(s), ` +
        `${result.playersResolved} joueurs reliés`
    );

    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[SYNC-CONTRACTS] Erreur:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
