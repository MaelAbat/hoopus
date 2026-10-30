import https from "node:https";
import { isEdgeDenial, UpstreamUnavailableError } from "./upstream";

/**
 * Accès unique au calendrier de la ligue.
 *
 * Ce fichier existe pour deux raisons.
 *
 * D'abord, trois routes (`sync-games`, `sync-playoffs`, `sync-season`)
 * récupéraient la même URL avec des en-têtes différents. Le CDN filtre les
 * requêtes trop peu caractérisées : les deux routes aux en-têtes minimaux se
 * sont mises à renvoyer 403 pendant que la troisième passait, sans que rien ne
 * le signale.
 *
 * Ensuite, le filtrage du CDN s'applique aussi par adresse IP, et peut durer.
 * Un 403 n'est donc pas une erreur définitive : on réessaie avec attente
 * croissante, puis on bascule sur `stats.nba.com/stats/scheduleleaguev2`, qui
 * sert exactement la même structure (`leagueSchedule.gameDates[].games[]`) mais
 * pour une saison explicite.
 */

/** En-têtes d'un navigateur réel — le CDN rejette les requêtes trop nues. */
export const NBA_CDN_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  // `identity` : on décode nous-mêmes, sans gzip à gérer.
  "Accept-Encoding": "identity",
  Referer: "https://www.nba.com/",
};

/** En-têtes attendus par stats.nba.com — les deux `x-nba-stats-*` sont requis. */
const NBA_STATS_HEADERS: Record<string, string> = {
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

const CDN_URL = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json";

function statsUrl(season: string): string {
  return `https://stats.nba.com/stats/scheduleleaguev2?LeagueID=00&Season=${encodeURIComponent(season)}`;
}

/** Statuts qui valent une nouvelle tentative plutôt qu'un abandon. */
function isRetryable(status: number | undefined): boolean {
  if (!status) return true; // erreur réseau
  return status === 403 || status === 408 || status === 429 || status >= 500;
}

function fetchJson(url: string, headers: Record<string, string>, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          const body = Buffer.concat(chunks).toString("utf-8");
          const err = new Error(`HTTP ${res.statusCode}`) as Error & {
            status?: number;
            permanent?: boolean;
          };
          err.status = res.statusCode;
          // Un refus au bord du CDN vise l'adresse IP appelante : réessayer trois
          // fois n'y changera rien, et coûte huit secondes par route.
          err.permanent = isEdgeDenial(body);
          reject(err);
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
        } catch {
          reject(new Error("Failed to parse schedule"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("Schedule fetch timeout"));
    });
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface FetchOptions {
  /**
   * Saison à demander à stats.nba.com si le CDN reste inaccessible. Sans elle,
   * un CDN bloqué fait échouer la synchronisation.
   */
  fallbackSeason?: string | null;
  attempts?: number;
  timeoutMs?: number;
}

/**
 * Calendrier complet de la ligue : CDN d'abord, puis stats.nba.com.
 *
 * Le type de retour est laissé à l'appelant — chaque route ne lit qu'une partie
 * du document et en décrit sa propre forme.
 */
export async function fetchLeagueSchedule<T = unknown>({
  fallbackSeason,
  attempts = 3,
  timeoutMs = 30000,
}: FetchOptions = {}): Promise<T> {
  let lastError: Error = new Error("jamais tenté");
  let edgeDenied = false;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return (await fetchJson(CDN_URL, NBA_CDN_HEADERS, timeoutMs)) as T;
    } catch (err) {
      lastError = err as Error;
      const { status, permanent } = err as Error & { status?: number; permanent?: boolean };
      edgeDenied = !!permanent;
      if (attempt === attempts || permanent || !isRetryable(status)) break;
      // 2s puis 6s : assez pour laisser retomber un pic sans faire exploser la
      // durée d'exécution de la fonction.
      await delay(2000 * Math.pow(3, attempt - 1));
    }
  }

  if (fallbackSeason) {
    // Un refus au bord vise l'adresse IP, et les deux hôtes de la ligue sont
    // derrière le même réseau de diffusion : le repli a très peu de chances
    // d'aboutir. Il vaut la peine d'être tenté — le blocage peut ne porter que
    // sur un hôte — mais pas d'immobiliser la route trente secondes, d'autant
    // que l'échec se manifeste par un silence et non par un refus rapide.
    const fallbackTimeout = edgeDenied ? Math.min(timeoutMs, 8000) : timeoutMs;
    try {
      return (await fetchJson(statsUrl(fallbackSeason), NBA_STATS_HEADERS, fallbackTimeout)) as T;
    } catch (err) {
      // Les deux sources sont muettes : une seule ligne, et une erreur que les
      // routes savent reconnaître comme « pas de notre fait ».
      throw new UpstreamUnavailableError(
        "Calendrier NBA",
        `CDN ${lastError.message}, stats.nba.com ${(err as Error).message}`,
        (lastError as Error & { status?: number }).status
      );
    }
  }

  throw new UpstreamUnavailableError(
    "Calendrier NBA",
    `CDN ${lastError.message}`,
    (lastError as Error & { status?: number }).status
  );
}

/** `leagueSchedule.seasonYear`, ou `null` s'il est illisible. */
export function readSeasonYear(schedule: unknown): string | null {
  const year = (schedule as { leagueSchedule?: { seasonYear?: unknown } })?.leagueSchedule
    ?.seasonYear;
  return typeof year === "string" && /^\d{4}-\d{2}$/.test(year) ? year : null;
}
