import { revalidatePath } from "next/cache";
import { keyOf, loadExisting, upsertChanged } from "@/lib/write-changed";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { fetchLeagueState } from "@/lib/league-season";
import { isCronAuthorized } from "@/lib/cron-auth";
import { fetchEspnJson } from "@/lib/espn-fetch";
import { isUpstreamUnavailable } from "@/lib/upstream";

// Saison résolue par requête depuis league_state (voir /api/sync-season).

// ESPN team abbreviations for all 30 teams
const ESPN_TEAMS = [
  "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GS",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NO", "NY",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SA", "TOR", "UTAH", "WSH",
];

// ESPN → NBA standard tricodes
const TRICODE_MAP: Record<string, string> = {
  GS: "GSW",
  NY: "NYK",
  SA: "SAS",
  NO: "NOP",
  WSH: "WAS",
  UTAH: "UTA",
};

// With ?team= param, injuries are a flat array (not grouped by team)
interface EspnInjuryEntry {
  status: string;
  date: string;
  athlete: {
    displayName: string;
    position?: { abbreviation?: string };
    team?: { abbreviation?: string };
  };
  details?: {
    type?: string;
    detail?: string;
    side?: string;
    returnDate?: string;
  };
  shortComment?: string;
}

interface EspnInjuryResponse {
  injuries: EspnInjuryEntry[];
  team?: { abbreviation?: string };
}

function fetchEspn(team: string): Promise<EspnInjuryResponse> {
  return fetchEspnJson<EspnInjuryResponse>(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries?team=${team}`,
    { label: `blessures ${team}` }
  );
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const startTime = Date.now();
  const now = new Date().toISOString();
  console.log("[SYNC-INJURIES] Starting sync...");
  const SEASON = (await fetchLeagueState()).currentSeason;
  console.log(`[SYNC-INJURIES] Saison ${SEASON}`);

  try {
    // Fetch all 30 teams in batches of 6 to avoid overwhelming ESPN
    const allInjuries: {
      player_name: string;
      player_position: string | null;
      team: string;
      status: string;
      injury_type: string | null;
      injury_detail: string | null;
      injury_side: string | null;
      return_date: string | null;
      short_comment: string | null;
      season: string;
      updated_at: string;
    }[] = [];

    // Équipes qui ont répondu, et celles qui n'ont pas répondu. Les deux
    // comptent : les premières bornent le remplacement, les secondes se
    // résument en une ligne au lieu de trente.
    const fetchedTeams = new Set<string>();
    const failures: string[] = [];

    const BATCH_SIZE = 6;
    for (let i = 0; i < ESPN_TEAMS.length; i += BATCH_SIZE) {
      const batch = ESPN_TEAMS.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(fetchEspn));

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status !== "fulfilled") {
          failures.push(batch[j]);
          continue;
        }

        const data = result.value;
        const espnTeamAbbr = data.team?.abbreviation || batch[j];
        const team = TRICODE_MAP[espnTeamAbbr] || espnTeamAbbr;
        fetchedTeams.add(team);

        for (const injury of data.injuries || []) {
          allInjuries.push({
            player_name: injury.athlete?.displayName || "Unknown",
            player_position: injury.athlete?.position?.abbreviation || null,
            team,
            status: injury.status || "Unknown",
            injury_type: injury.details?.type || null,
            injury_detail: injury.details?.detail || null,
            injury_side: injury.details?.side || null,
            return_date: injury.details?.returnDate || null,
            short_comment: injury.shortComment || null,
            season: SEASON,
            updated_at: now,
          });
        }
      }
    }

    if (failures.length > 0) {
      console.warn(
        `[SYNC-INJURIES] ${failures.length}/${ESPN_TEAMS.length} équipe(s) injoignable(s) : ${failures.join(", ")}`
      );
    }

    // ESPN muet sur les trente équipes : ne rien toucher. Le remplacement qui
    // suit effacerait l'infirmerie pour la remplacer par du vide — une panne de
    // la source viderait la page au lieu de la laisser sur ses dernières
    // données connues.
    if (fetchedTeams.size === 0) {
      console.warn(`[SYNC-INJURIES] ESPN indisponible — infirmerie inchangée`);
      return NextResponse.json({
        ok: true,
        skipped: "ESPN indisponible",
        teams: 0,
        timestamp: now,
      });
    }

    console.log(
      `[SYNC-INJURIES] ${allInjuries.length} blessure(s) sur ${fetchedTeams.size} équipe(s)`
    );

    // Mise à jour différentielle, bornée aux équipes qui ont répondu : effacer
    // la saison entière priverait de leurs blessures celles qui n'ont pas
    // répondu. Tout effacer puis tout réinsérer à chaque passage coûtait des
    // centaines d'écritures pour une infirmerie qui bouge de quelques lignes.
    const KEY = ["player_name", "team"] as const;
    const COMPARE = [
      "player_position", "status", "injury_type", "injury_detail", "injury_side", "return_date", "short_comment",
    ] as const;
    const teams = [...fetchedTeams];
    const existing = await loadExisting(supabase, "injuries", [...COMPARE, "id"], KEY, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filter: (q: any) => q.eq("season", SEASON).in("team", teams),
      order: ["id"],
    });

    // Un même joueur listé deux fois ferait échouer l'upsert entier.
    const fresh = [...new Map(allInjuries.map((r) => [keyOf(r, KEY), r])).values()];
    const freshKeys = new Set(fresh.map((r) => keyOf(r, KEY)));
    const healed = [...existing.entries()].filter(([k]) => !freshKeys.has(k)).map(([, r]) => r.id as number);

    if (healed.length > 0) {
      const { error: delError } = await supabase.from("injuries").delete().in("id", healed);
      if (delError) console.error(`[SYNC-INJURIES] Delete error:`, delError.message);
    }

    const { written, unchanged } = await upsertChanged(supabase, "injuries", fresh, {
      existing,
      key: KEY,
      compare: COMPARE,
      onConflict: "player_name,team,season",
    });
    console.log(`[SYNC-INJURIES] ${written} écrite(s), ${unchanged} inchangée(s), ${healed.length} retirée(s)`);

    revalidatePath("/blessures");
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC-INJURIES] Completed at ${now} (took ${duration}s)`);

    return NextResponse.json({
      ok: true,
      injuries: allInjuries.length,
      teams: fetchedTeams.size,
      unreachable: failures.length || undefined,
      timestamp: now,
    });
  } catch (err) {
    if (isUpstreamUnavailable(err)) {
      console.warn(`[SYNC-INJURIES] ${err.source} indisponible (${err.message}) — infirmerie inchangée`);
      return NextResponse.json({
        ok: true,
        skipped: `${err.source} indisponible`,
        reason: err.message,
        timestamp: now,
      });
    }
    console.error("[SYNC-INJURIES] Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
