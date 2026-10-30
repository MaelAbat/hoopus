import https from "node:https";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { seasonBefore } from "@/lib/season";
import { brTeamFor, fetchAllSalaries, normalizeName } from "@/lib/br-salaries";
import { fetchLeagueState } from "@/lib/league-season";
import { isCronAuthorized } from "@/lib/cron-auth";
import { isUpstreamUnavailable, UpstreamUnavailableError } from "@/lib/upstream";
import { isEspnSeason } from "@/lib/boxscore-stats";
import { fetchEspnRosters } from "@/lib/espn-rosters";
import { loadExisting, upsertChanged } from "@/lib/write-changed";

// Saison résolue par requête depuis league_state (voir /api/sync-season).
const BATCH_SIZE = 200;
/**
 * Équipes interrogées chez Basketball Reference à chaque passage.
 *
 * Huit requêtes espacées de 3,2 s tiennent sous la limite de débit de BR et
 * sous la durée maximale de la fonction. Les 30 équipes se rafraîchissent donc
 * en quatre jours, ce qui suffit pour des salaires qui bougent rarement — et
 * les salaires connus sont conservés entre-temps.
 */
const TEAMS_PER_RUN = 8;

const NBA_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Encoding": "identity",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  Host: "stats.nba.com",
  Origin: "https://www.nba.com",
  Referer: "https://www.nba.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

interface NbaResponse {
  resultSets: {
    headers: string[];
    rowSet: (string | number | null)[][];
  }[];
}

function fetchNba(url: string, timeoutMs = 300000): Promise<NbaResponse> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: NBA_HEADERS }, (res) => {
      clearTimeout(silent);
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`NBA API error: ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
        } catch {
          reject(new Error("Failed to parse NBA API response"));
        }
      });
    });
    // Un hôte injoignable ne répond jamais : sans échéance sur les en-têtes, la
    // route attendrait le budget entier — dix minutes — avant de le constater.
    // Une réponse lente mais vivante envoie ses en-têtes tout de suite et garde
    // tout ce budget pour son corps, qui est ce qui prend du temps ici.
    const silent = setTimeout(() => {
      req.destroy(new UpstreamUnavailableError("stats.nba.com", "aucune réponse en 15s"));
    }, 15_000);
    req.on("error", (err) => { clearTimeout(silent); reject(err); });
    req.setTimeout(600000, () => { clearTimeout(silent); req.destroy(); reject(new Error("timeout after 10min")); });
  });
}

/** Fetch biostats for one season in a single call. */
async function fetchBioStatsForSeason(season: string): Promise<Map<number, number>> {
  const ageMap = new Map<number, number>();

  try {
    console.log(`[SYNC-ROSTERS] Fetching bio stats for ${season} (timeout 10min)...`);
    const bioData = await fetchNba(
      "https://stats.nba.com/stats/leaguedashplayerbiostats?" +
        "College=&Conference=&Country=&DateFrom=&DateTo=&Division=" +
        "&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=" +
        "&ISTRound=&LastNGames=0&LeagueID=00&Location=&Month=0" +
        "&OpponentTeamID=0&Outcome=&PORound=0&PerMode=PerGame" +
        "&Period=0&PlayerExperience=&PlayerPosition=&Season=" + season +
        "&SeasonSegment=&SeasonType=Regular+Season" +
        "&ShotClockRange=&StarterBench=&TeamID=0" +
        "&VsConference=&VsDivision=&Weight="
    );

    const headers = bioData.resultSets[0].headers;
    const pidIdx = headers.indexOf("PLAYER_ID");
    const ageIdx = headers.indexOf("AGE");
    for (const row of bioData.resultSets[0].rowSet) {
      const pid = Number(row[pidIdx]);
      const age = row[ageIdx] != null ? Number(row[ageIdx]) : null;
      if (pid && age) ageMap.set(pid, age);
    }
    console.log(`[SYNC-ROSTERS] Got ages for ${ageMap.size} players (${season})`);
  } catch (err) {
    console.error("[SYNC-ROSTERS] Bio stats fetch failed (non-fatal):", (err as Error).message);
  }

  return ageMap;
}

/**
 * Âges des joueurs, avec repli sur la saison précédente.
 *
 * Les bio stats d'une saison qui n'a pas commencé sont vides. Sans repli, tous
 * les effectifs de l'intersaison perdraient l'âge de leurs joueurs. Les valeurs
 * reprises accusent alors jusqu'à un an de retard, jusqu'au coup d'envoi.
 */
async function fetchAllBioStats(season: string): Promise<Map<number, number>> {
  const ages = await fetchBioStatsForSeason(season);
  if (ages.size > 0) return ages;

  const previous = seasonBefore(season);
  console.log(`[SYNC-ROSTERS] Aucune bio stat pour ${season}, repli sur ${previous}`);
  return fetchBioStatsForSeason(previous);
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

  try {
    console.log("[SYNC-ROSTERS] Starting sync...");
    const SEASON = (await fetchLeagueState()).currentSeason;
    console.log(`[SYNC-ROSTERS] Saison ${SEASON}`);
    // Read active players from Supabase (already synced by sync-players)
    const { data: dbPlayers, error: dbError } = await supabase
      .from("players")
      .select("*")
      .eq("is_active", true);

    if (dbError || !dbPlayers || dbPlayers.length === 0) {
      throw new Error("No active players in database. Run sync-players first.");
    }
    console.log(`[SYNC-ROSTERS] Found ${dbPlayers.length} active players in database`);

    // ── Choix des équipes à interroger ──
    // Basketball Reference limite le débit : on ne balaie pas les 30 équipes à
    // chaque passage. Priorité aux équipes sans aucun salaire, puis aux plus
    // anciennement rafraîchies. Combiné à la conservation des salaires connus,
    // la base converge en quelques jours et ne perd jamais rien.
    const { data: salaryState } = await supabase
      .from("rosters")
      .select("team_tricode, salary, updated_at")
      .eq("season", SEASON);

    const perTeam = new Map<string, { withSalary: number; oldest: string }>();
    for (const row of salaryState || []) {
      const entry = perTeam.get(row.team_tricode) ?? { withSalary: 0, oldest: row.updated_at };
      if (row.salary) entry.withSalary++;
      if (row.updated_at < entry.oldest) entry.oldest = row.updated_at;
      perTeam.set(row.team_tricode, entry);
    }

    const allTeams = [...new Set(dbPlayers.map((p) => p.team_tricode).filter(Boolean))] as string[];
    const priority = allTeams.sort((a, b) => {
      const ea = perTeam.get(a);
      const eb = perTeam.get(b);
      const aEmpty = (ea?.withSalary ?? 0) === 0 ? 0 : 1;
      const bEmpty = (eb?.withSalary ?? 0) === 0 ? 0 : 1;
      if (aEmpty !== bEmpty) return aEmpty - bEmpty; // les vides d'abord
      return (ea?.oldest ?? "").localeCompare(eb?.oldest ?? ""); // puis les plus anciennes
    });

    const targets = priority.slice(0, TEAMS_PER_RUN).map(brTeamFor);
    console.log(
      `[SYNC-ROSTERS] ${targets.length} équipe(s) interrogée(s) sur ${allTeams.length} : ` +
        priority.slice(0, TEAMS_PER_RUN).join(", ")
    );

    // Fetch bio stats (ages) and salaries in parallel
    console.log("[SYNC-ROSTERS] Fetching from NBA API and Basketball Reference...");
    const [ageMap, salaryResult] = await Promise.all([
      // Les âges venaient des bio stats de stats.nba.com, qui ne répond plus :
      // ESPN les donne avec ses effectifs.
      (await isEspnSeason(supabase, SEASON))
        ? fetchEspnRosters(supabase).then(
            ({ players }) =>
              new Map(players.filter((p) => p.age != null).map((p) => [p.playerId, p.age as number]))
          )
        : fetchAllBioStats(SEASON),
      (async () => {
        try {
          return await fetchAllSalaries(SEASON, targets);
        } catch (err) {
          console.error("Salary scraping failed (non-fatal):", err);
          return {
            salaryMap: new Map<string, string>(),
            fetched: [] as string[],
            failed: [] as string[],
          };
        }
      })(),
    ]);

    const { salaryMap, failed } = salaryResult;
    console.log(`[SYNC-ROSTERS] Fetched ${ageMap.size} ages, ${salaryMap.size} salaries`);

    // ── Salaires déjà connus ──
    // Une synchronisation ne doit jamais détruire de données valides. Sans ce
    // repli, un incident chez Basketball Reference (429, coupure) rendait un
    // `salaryMap` vide et remettait toute la colonne salaires à null. On
    // conserve donc la valeur déjà en base pour les joueurs que le scraping
    // n'a pas couverts.
    const { data: knownRows } = await supabase
      .from("rosters")
      .select("player_id, salary")
      .eq("season", SEASON)
      .not("salary", "is", null);
    const knownSalaries = new Map<number, string>(
      (knownRows || []).map((r) => [r.player_id, r.salary as string])
    );
    if (knownSalaries.size > 0) {
      console.log(`[SYNC-ROSTERS] ${knownSalaries.size} salaires déjà en base, conservés à défaut`);
    }

    const now = new Date().toISOString();
    const players = [];
    let preserved = 0;

    for (const p of dbPlayers) {
      if (!p.team_tricode) continue;

      const salaryKey = normalizeName(`${p.first_name} ${p.last_name}`) + "|" + p.team_tricode;
      let salary = salaryMap.get(salaryKey) ?? null;
      if (!salary) {
        const known = knownSalaries.get(p.player_id);
        if (known) {
          salary = known;
          preserved++;
        }
      }

      players.push({
        season: SEASON,
        player_id: p.player_id,
        first_name: p.first_name,
        last_name: p.last_name,
        team_tricode: p.team_tricode,
        team_name: p.team_name || "",
        team_city: p.team_city || "",
        jersey_number: p.jersey_number ?? "",
        position: p.position || "",
        height: p.height || "",
        weight: p.weight || "",
        age: ageMap.get(p.player_id) || null,
        college: p.college || "",
        country: p.country || "",
        draft_year: p.draft_year || null,
        draft_round: p.draft_round || null,
        draft_number: p.draft_number || null,
        pts: p.pts,
        reb: p.reb,
        ast: p.ast,
        salary,
        updated_at: now,
      });
    }

    // Upsert rosters (avoids emptying table on partial failures). Seules les
    // lignes nouvelles ou modifiées partent : un effectif bouge peu d'un jour à
    // l'autre, et tout réécrire usait le budget d'accès disque de Supabase.
    const rosterCompare = Object.keys(players[0] ?? {}).filter(
      (k) => k !== "player_id" && k !== "season" && k !== "updated_at"
    );
    const existingRoster = await loadExisting(supabase, "rosters", rosterCompare, ["player_id"], {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filter: (q: any) => q.eq("season", SEASON),
      order: ["player_id"],
    });
    const rosterWrite = await upsertChanged(supabase, "rosters", players, {
      existing: existingRoster,
      key: ["player_id"],
      compare: rosterCompare,
      onConflict: "player_id,season",
      batchSize: BATCH_SIZE,
    });
    const inserted = rosterWrite.written + rosterWrite.unchanged;
    console.log(`[SYNC-ROSTERS] ${rosterWrite.written} ligne(s) écrite(s), ${rosterWrite.unchanged} inchangée(s)`);

    // ── Masses salariales ──
    // Dérivées des salaires que l'on vient d'attribuer, et de rien d'autre : le
    // total affiché est donc toujours exactement la somme des contrats affichés.
    // Un accumulateur séparé avait produit des totaux au double du réel sans que
    // les salaires individuels, eux, soient faux.
    //
    // `players` couvre les 30 équipes — y compris celles non interrogées ce
    // coup-ci, dont les salaires ont été conservés — donc le calcul est complet
    // même sur un balayage partiel. On n'écrit que si chaque équipe a un total,
    // pour ne pas mélanger des équipes chiffrées et des équipes à zéro.
    const payrollByTeam = new Map<string, number>();
    for (const p of players) {
      const amount = p.salary ? Number(p.salary.replace(/[$,]/g, "")) || 0 : 0;
      payrollByTeam.set(p.team_tricode, (payrollByTeam.get(p.team_tricode) ?? 0) + amount);
    }
    const complete = [...payrollByTeam.values()].every((v) => v > 0);

    if (!complete) {
      const missing = [...payrollByTeam.entries()].filter(([, v]) => v === 0).map(([t]) => t);
      console.warn(
        `[SYNC-ROSTERS] Masses salariales incomplètes — ${missing.length} équipe(s) sans contrat : ` +
          `${missing.join(", ")} — écriture ignorée`
      );
    } else {
      const payrollRows = [...payrollByTeam.entries()].map(([tricode, payroll]) => ({
        season: SEASON,
        team_tricode: tricode,
        payroll,
        updated_at: now,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: payrollError } = await supabase.from("team_payrolls").upsert(payrollRows as any, {
        onConflict: "team_tricode,season",
      });
      if (payrollError) console.error("Payroll upsert error:", payrollError);
      else console.log(`[SYNC-ROSTERS] ${payrollRows.length} masses salariales écrites`);
    }

    // ── Purge des joueurs sortis de la ligue ──
    // L'upsert n'enlève rien : les joueurs présents lors d'une synchronisation
    // précédente mais absents de celle-ci restaient dans l'effectif de la
    // saison. Après l'intersaison 2026, 30 partants figuraient encore dans les
    // effectifs 2026-27 avec leur ancienne équipe.
    let pruned = 0;
    if (players.length > 0) {
      const keptIds = players.map((p) => p.player_id);
      const { data: removed, error: pruneError } = await supabase
        .from("rosters")
        .delete()
        .eq("season", SEASON)
        .not("player_id", "in", `(${keptIds.join(",")})`)
        .select("player_id, first_name, last_name, team_tricode");

      if (pruneError) {
        console.error("[SYNC-ROSTERS] Purge échouée:", pruneError.message);
      } else {
        pruned = removed?.length ?? 0;
        if (pruned > 0) {
          const names = (removed ?? [])
            .slice(0, 10)
            .map((p) => `${p.first_name} ${p.last_name} (${p.team_tricode})`)
            .join(", ");
          console.log(
            `[SYNC-ROSTERS] ${pruned} joueur(s) retiré(s) de l'effectif ${SEASON} : ${names}` +
              (pruned > 10 ? ", ..." : "")
          );
        }
      }
    }

    if (preserved > 0) {
      console.log(`[SYNC-ROSTERS] ${preserved} salaire(s) repris de la base, source incomplète`);
    }
    console.log(`[SYNC-ROSTERS] Upserted ${inserted} rows successfully`);
    revalidatePath("/equipes");
    revalidatePath("/trades");
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC-ROSTERS] Completed at ${now} (took ${duration}s)`);

    return NextResponse.json({
      ok: true,
      season: SEASON,
      players: inserted,
      pruned,
      preserved,
      salaries: salaryMap.size,
      teamsFetched: salaryResult.fetched,
      teamsFailed: failed,
      payrolls: complete ? payrollByTeam.size : 0,
      timestamp: now,
    });
  } catch (err) {
    // Source injoignable : ce n'est pas une panne de la route. Une ligne, pas
    // une trace, et rien n'est écrit — les données en base valent mieux qu'un
    // écrasement par du vide.
    if (isUpstreamUnavailable(err)) {
      console.warn(`[SYNC-ROSTERS] ${err.source} indisponible (${err.message}) — effectifs inchangés`);
      return NextResponse.json({
        ok: true,
        skipped: `${err.source} indisponible`,
        reason: err.message,
        timestamp: new Date().toISOString(),
      });
    }
    console.error("Error syncing rosters:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
