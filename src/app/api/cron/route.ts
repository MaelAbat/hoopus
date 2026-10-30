import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";

/** Issue d'une étape, telle que lue dans sa réponse. */
type StepStatus = "ok" | "skip" | "fail";

interface StepResult {
  status: StepStatus;
  /** Statut HTTP de la route appelée. */
  http: number;
  seconds: number;
  /** Raison d'un échec ou d'une étape sautée. */
  detail?: string;
  data?: Record<string, unknown>;
}

/**
 * Appelle une route de sync et rend compte de son issue, sans jamais lever.
 *
 * Une route qui dépasse sa durée répond par une page d'erreur de Vercel, pas
 * par du JSON. Lue avec `res.json()`, elle faisait planter tout le cron à la
 * fin de la chaîne — « Unexpected token 'A', "An error o"… » — sans dire quelle
 * étape avait cédé. Chaque étape est donc lue isolément, et journalisée par son
 * nom : en erreur (`console.error`, en rouge dans les logs Vercel) si elle a
 * échoué, en avertissement si sa source était injoignable.
 */
async function runStep(name: string, url: string): Promise<StepResult> {
  const started = Date.now();
  const seconds = () => Number(((Date.now() - started) / 1000).toFixed(1));

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    const result: StepResult = { status: "fail", http: 0, seconds: seconds(), detail: `appel impossible : ${(err as Error).message}` };
    console.error(`[CRON] ✗ ${name} — ${result.detail} (${result.seconds}s)`);
    return result;
  }

  const body = await res.text();
  let data: Record<string, unknown> | undefined;
  try {
    data = JSON.parse(body);
  } catch {
    // Page d'erreur de Vercel (durée dépassée, plantage) ou challenge du pare-feu.
    const hint = /FUNCTION_INVOCATION_TIMEOUT|timed out/i.test(body)
      ? "durée maximale dépassée"
      : res.headers.get("x-vercel-mitigated")
        ? "bloquée par le pare-feu Vercel"
        : "réponse illisible";
    const result: StepResult = {
      status: "fail",
      http: res.status,
      seconds: seconds(),
      detail: `${hint} — HTTP ${res.status} : ${body.slice(0, 120).replace(/\s+/g, " ")}`,
    };
    console.error(`[CRON] ✗ ${name} — ${result.detail} (${result.seconds}s)`);
    return result;
  }

  if (!res.ok || data?.ok === false || data?.error) {
    const result: StepResult = {
      status: "fail",
      http: res.status,
      seconds: seconds(),
      detail: String(data?.error ?? `HTTP ${res.status}`),
      data,
    };
    console.error(`[CRON] ✗ ${name} — ${result.detail} (${result.seconds}s)`);
    return result;
  }

  if (data?.skipped) {
    const result: StepResult = {
      status: "skip",
      http: res.status,
      seconds: seconds(),
      detail: `${data.skipped}${data.reason ? ` — ${data.reason}` : ""}`,
      data,
    };
    console.warn(`[CRON] ~ ${name} sautée — ${result.detail} (${result.seconds}s)`);
    return result;
  }

  const result: StepResult = { status: "ok", http: res.status, seconds: seconds(), data };
  console.log(`[CRON] ✓ ${name} (${result.seconds}s)`);
  return result;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`[CRON] Sync started at ${new Date().toISOString()}`);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002";
  const cronSecret = process.env.CRON_SECRET || "";
  const authParam = `cron_secret=${encodeURIComponent(cronSecret)}`;
  const step = (name: string) => runStep(name, `${baseUrl}/api/sync-${name}?${authParam}`);

  const steps: Record<string, StepResult> = {};

  // La bascule de saison passe EN PREMIER : tous les autres endpoints lisent
  // league_state pour savoir dans quelle saison écrire. L'inverser ferait
  // atterrir une journée de données dans la saison précédente.
  steps.season = await step("season");
  const season = steps.season.data ?? {};
  console.log(
    `[CRON] Saison courante ${season.currentSeason ?? "?"} ` +
      `(stats ${season.statsSeason ?? "?"}, calendrier ${season.scheduleSeason ?? "?"})`
  );

  // Sources rapides (ESPN, CDN) en parallèle.
  const [games, standings, playoffs, injuries] = await Promise.all(
    ["games", "standings", "playoffs", "injuries"].map(step)
  );
  Object.assign(steps, { games, standings, playoffs, injuries });

  // Statistiques, puis ce qui en dépend : sync-team-stats et sync-career
  // réutilisent les box scores que sync-stats vient de compléter.
  steps.stats = await step("stats");
  steps["team-stats"] = await step("team-stats");
  steps.career = await step("career");

  // sync-players doit précéder sync-rosters, qui lit la table players : sans
  // lui, les changements d'équipe n'arrivent jamais.
  steps.players = await step("players");
  steps.rosters = await step("rosters");

  // Sources Basketball Reference, à la suite des effectifs : BR limite le débit
  // et répond 429 quand deux lectures se chevauchent. sync-players doit précéder
  // ces deux-là, qui relient les mouvements aux fiches joueurs par le nom.
  steps.transactions = await step("transactions");
  steps.draft = await step("draft");
  // Les montants des contrats tournent par rotation d'équipes : aucune source de
  // transactions ne chiffre ses lignes, et les trente pages de BR ne tiennent pas
  // dans une seule exécution.
  steps.contracts = await step("contracts");

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

  const failed = Object.entries(steps).filter(([, r]) => r.status === "fail").map(([name]) => name);
  const skipped = Object.entries(steps).filter(([, r]) => r.status === "skip").map(([name]) => name);
  const timestamp = new Date().toISOString();

  const summary =
    `[CRON] Terminé à ${timestamp} — ${Object.keys(steps).length - failed.length - skipped.length} OK` +
    (skipped.length ? `, sautées : ${skipped.join(", ")}` : "") +
    (failed.length ? `, EN ÉCHEC : ${failed.join(", ")}` : "");
  if (failed.length) console.error(summary);
  else console.log(summary);

  // Une étape en échec fait échouer le cron : Vercel l'affiche alors en erreur,
  // au lieu d'un succès qui ne se voit qu'en lisant les logs. Une étape sautée
  // (source injoignable) n'est qu'un avertissement.
  return NextResponse.json(
    { ok: failed.length === 0, failed, skipped, steps, timestamp },
    { status: failed.length ? 500 : 200 }
  );
}
