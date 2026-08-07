import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`[CRON] Sync started at ${new Date().toISOString()}`);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002";
  const cronSecret = process.env.CRON_SECRET || "";
  const authParam = `cron_secret=${encodeURIComponent(cronSecret)}`;

  // La bascule de saison passe EN PREMIER : tous les autres endpoints lisent
  // league_state pour savoir dans quelle saison écrire. L'inverser ferait
  // atterrir une journée de données dans la saison précédente.
  const seasonRes = await fetch(`${baseUrl}/api/sync-season?${authParam}`);
  const seasonData = await seasonRes.json();
  console.log(
    `[CRON] Saison courante ${seasonData.currentSeason ?? "?"} ` +
      `(stats ${seasonData.statsSeason ?? "?"}, calendrier ${seasonData.scheduleSeason ?? "?"})`
  );

  // Sync non-NBA-stats sources in parallel (CDN/ESPN — no rate limit)
  const [gamesRes, standingsRes, playoffsRes, injuriesRes] = await Promise.all([
    fetch(`${baseUrl}/api/sync-games?${authParam}`),
    fetch(`${baseUrl}/api/sync-standings?${authParam}`),
    fetch(`${baseUrl}/api/sync-playoffs?${authParam}`),
    fetch(`${baseUrl}/api/sync-injuries?${authParam}`),
  ]);

  // Sync stats.nba.com sources sequentially to avoid rate limiting.
  // sync-players doit précéder sync-rosters, qui lit la table players : sans
  // lui, les changements d'équipe de l'intersaison n'arrivent jamais.
  const statsRes = await fetch(`${baseUrl}/api/sync-stats?${authParam}`);
  const teamStatsRes = await fetch(`${baseUrl}/api/sync-team-stats?${authParam}`);
  const playersRes = await fetch(`${baseUrl}/api/sync-players?${authParam}`);
  const rostersRes = await fetch(`${baseUrl}/api/sync-rosters?${authParam}`);

  // Sources Basketball Reference, à la suite des effectifs : BR limite le débit
  // et répond 429 quand deux lectures se chevauchent. sync-players doit précéder
  // ces deux-là, qui relient les mouvements aux fiches joueurs par le nom.
  const transactionsRes = await fetch(`${baseUrl}/api/sync-transactions?${authParam}`);
  const draftRes = await fetch(`${baseUrl}/api/sync-draft?${authParam}`);
  // Les montants des contrats tournent par rotation d'équipes : aucune source de
  // transactions ne chiffre ses lignes, et les trente pages de BR ne tiennent pas
  // dans une seule exécution.
  const contractsRes = await fetch(`${baseUrl}/api/sync-contracts?${authParam}`);

  const [gamesData, standingsData, playoffsData, injuriesData, statsData, teamStatsData, playersData, rostersData, transactionsData, draftData, contractsData] = await Promise.all([
    gamesRes.json(),
    standingsRes.json(),
    playoffsRes.json(),
    injuriesRes.json(),
    statsRes.json(),
    teamStatsRes.json(),
    playersRes.json(),
    rostersRes.json(),
    transactionsRes.json(),
    draftRes.json(),
    contractsRes.json(),
  ]);

  // Revalidate all data-driven pages after sync
  revalidatePath("/");
  revalidatePath("/calendrier");
  revalidatePath("/classement");
  revalidatePath("/statistiques");
  revalidatePath("/playoffs");
  revalidatePath("/equipes");
  revalidatePath("/blessures");
  revalidatePath("/trades");
  revalidatePath("/joueurs");
  revalidatePath("/mini-jeux");
  revalidatePath("/mercato");
  revalidatePath("/draft");

  const results = {
    ok: true,
    season: seasonData,
    stats: statsData,
    games: gamesData,
    standings: standingsData,
    injuries: injuriesData,
    teamStats: teamStatsData,
    playoffs: playoffsData,
    players: playersData,
    rosters: rostersData,
    transactions: transactionsData,
    draft: draftData,
    contracts: contractsData,
    timestamp: new Date().toISOString(),
  };

  console.log(`[CRON] Sync completed at ${results.timestamp}`);
  console.log(`[CRON] Results:`, JSON.stringify({
    stats: statsData.ok ?? statsData.error,
    games: gamesData.ok ?? gamesData.error,
    standings: standingsData.ok ?? standingsData.error,
    injuries: injuriesData.ok ?? injuriesData.error,
    teamStats: teamStatsData.ok ?? teamStatsData.error,
    playoffs: playoffsData.ok ?? playoffsData.error,
    players: playersData.ok ?? playersData.error,
    rosters: rostersData.ok ?? rostersData.error,
    transactions: transactionsData.ok ?? transactionsData.error,
    draft: draftData.ok ?? draftData.error,
    contracts: contractsData.ok ?? contractsData.error,
  }));

  return NextResponse.json(results);
}
