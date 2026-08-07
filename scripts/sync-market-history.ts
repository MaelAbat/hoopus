/**
 * Rattrapage historique du marché : mouvements, drafts et grilles de loterie.
 *
 * À lancer à la main, jamais depuis le cron : une page par saison à trois
 * secondes d'intervalle dépasse largement la minute allouée à une fonction
 * serverless. Le cron entretient la saison courante, ce script remplit le passé.
 *
 * Usage :
 *   npm run sync:market                     # de 2015-16 à la saison courante
 *   npm run sync:market 2018-19             # une saison
 *   npm run sync:market 2018-19 2020-21     # plusieurs saisons
 *   npm run sync:market -- --skip-draft     # mouvements seulement
 *   npm run sync:market -- --drafts-since 1950   # toutes les drafts NBA, sans les mouvements
 *   npm run sync:market -- --espn                # mouvements récents vus par ESPN
 *   npm run sync:market -- --espn 2024           # une année civile ESPN
 *
 * Le marché et les drafts n'ont pas le même horizon. Les mouvements commencent en
 * 2015-16, comme le reste du site : avant, ni effectifs ni classements ne sont en
 * base pour leur donner du sens. Les drafts, elles, se lisent seules et remontent
 * à 1950, première draft de la NBA — celles de 1947 à 1949 étaient organisées par
 * la BAA.
 *
 * Rien n'est effacé : tout passe par upsert, et relancer le script est sans
 * conséquence — les empreintes de mouvements sont déterministes.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { seasonFromStartYear, seasonStartYear } from "../src/lib/season";
import { syncDraftYear, syncEspnTransactions, syncSeasonTransactions } from "../src/lib/market-sync";
import { BR_REQUEST_INTERVAL_MS, delay } from "../src/lib/br-fetch";
import { FIRST_NBA_DRAFT } from "../src/lib/br-draft";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/** Première saison couverte par le site. */
const FIRST_SEASON = "2015-16";

const args = process.argv.slice(2);
const skipDraft = args.includes("--skip-draft");
const skipTransactions = args.includes("--skip-transactions");
const requested = args.filter((a) => /^\d{4}-\d{2}$/.test(a));

/**
 * `--espn [année]` : lecture d'ESPN, qui publie au jour près là où Basketball
 * Reference prend des semaines. L'année est civile, comme leur API.
 */
const espnArg = args.indexOf("--espn");
const useEspn = espnArg !== -1;
const espnYear = useEspn ? Number(args[espnArg + 1]) || undefined : undefined;

/** `--drafts-since 1950` : balayage des drafts seules, sans les mouvements. */
const draftsSinceArg = args.indexOf("--drafts-since");
const draftsSince =
  draftsSinceArg !== -1 ? Math.max(FIRST_NBA_DRAFT, Number(args[draftsSinceArg + 1])) : null;

/** Saison de la ligue, lue en base — la même référence que le site. */
async function currentSeason(): Promise<string> {
  const { data } = await supabase.from("league_state").select("current_season").limit(1).maybeSingle();
  return data?.current_season || seasonFromStartYear(new Date().getFullYear());
}

/** Suite de saisons, bornes comprises. */
function seasonRange(from: string, to: string): string[] {
  const first = seasonStartYear(from);
  const last = seasonStartYear(to);
  if (last < first) return [from];
  return Array.from({ length: last - first + 1 }, (_, i) => seasonFromStartYear(first + i));
}

/**
 * Balayage des drafts seules, de l'année demandée à la dernière connue.
 *
 * Une draft se lit sans rien d'autre : ni effectif, ni classement. Rien n'empêche
 * donc de remonter à 1950, là où les mouvements s'arrêtent à 2015-16.
 */
async function syncDraftsSince(from: number) {
  const startTime = Date.now();
  const last = seasonStartYear(await currentSeason());
  const years = Array.from({ length: last - from + 1 }, (_, i) => from + i).reverse();

  console.log(`Drafts — ${years.length} année(s) : ${from} → ${last}`);
  console.log(`Lecture polie de Basketball Reference : ${(BR_REQUEST_INTERVAL_MS / 1000).toFixed(1)}s entre deux pages\n`);

  let totalPicks = 0;
  let empty = 0;
  const failures: number[] = [];

  for (const year of years) {
    try {
      const result = await syncDraftYear(supabase, year, (m) => console.log(`    ${m}`));
      totalPicks += result.picks;
      if (result.picks === 0) empty++;
    } catch (err) {
      console.log(`  ${year} — erreur : ${(err as Error).message}`);
      failures.push(year);
    }
    await delay(BR_REQUEST_INTERVAL_MS);
  }

  const minutes = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nTerminé en ${minutes} minutes`);
  console.log(`  ${totalPicks} choix sur ${years.length - empty - failures.length} draft(s)`);
  if (empty > 0) console.log(`  ${empty} année(s) sans page publiée`);
  if (failures.length > 0) console.log(`  Échecs : ${failures.join(", ")}`);
}

async function main() {
  if (draftsSince !== null) return syncDraftsSince(draftsSince);

  if (useEspn) {
    console.log(`ESPN — ${espnYear ?? "année en cours"}\n`);
    const result = await syncEspnTransactions(supabase, espnYear, (m) => console.log(`    ${m}`));
    console.log(`\n${result.written} mouvement(s) écrits, ${result.playersResolved} joueurs reliés`);
    console.log(`  saisons touchées : ${result.seasonsTouched.join(", ") || "aucune"}`);
    return;
  }

  const startTime = Date.now();
  const seasons =
    requested.length > 0 ? requested : seasonRange(FIRST_SEASON, await currentSeason());

  console.log(`Mercato — ${seasons.length} saison(s) : ${seasons[0]} → ${seasons[seasons.length - 1]}`);
  console.log(`Lecture polie de Basketball Reference : ${(BR_REQUEST_INTERVAL_MS / 1000).toFixed(1)}s entre deux pages\n`);

  let totalEvents = 0;
  let totalPicks = 0;
  const failures: string[] = [];

  for (const season of seasons) {
    console.log(`${season}`);

    if (!skipTransactions) {
      try {
        const result = await syncSeasonTransactions(supabase, season, (m) => console.log(`    ${m}`));
        totalEvents += result.written;
        console.log(
          `    ${result.written} mouvements écrits, ${result.playersResolved} joueurs reliés` +
            (result.pagesMissing > 0 ? `, ${result.pagesMissing} page(s) absente(s)` : "")
        );
      } catch (err) {
        console.log(`    Erreur mouvements : ${(err as Error).message}`);
        failures.push(`${season} (mouvements)`);
      }
      await delay(BR_REQUEST_INTERVAL_MS);
    }

    if (!skipDraft) {
      try {
        const result = await syncDraftYear(supabase, seasonStartYear(season), (m) => console.log(`    ${m}`));
        totalPicks += result.picks;
        if (result.lotterySkipped) {
          console.log("    loterie ignorée — playoffs de la saison précédente inconnus");
        }
      } catch (err) {
        console.log(`    Erreur draft : ${(err as Error).message}`);
        failures.push(`${season} (draft)`);
      }
      await delay(BR_REQUEST_INTERVAL_MS);
    }

    console.log("");
  }

  const minutes = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`Terminé en ${minutes} minutes`);
  console.log(`  ${totalEvents} mouvements`);
  console.log(`  ${totalPicks} choix de draft`);
  if (failures.length > 0) console.log(`  Échecs : ${failures.join(", ")}`);
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
