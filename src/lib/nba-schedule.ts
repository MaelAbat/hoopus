import https from "node:https";

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
          const err = new Error(`CDN error: ${res.statusCode}`) as Error & { status?: number };
          err.status = res.statusCode;
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
  let lastError: Error = new Error("Schedule fetch never attempted");

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return (await fetchJson(CDN_URL, NBA_CDN_HEADERS, timeoutMs)) as T;
    } catch (err) {
      lastError = err as Error;
      const status = (err as Error & { status?: number }).status;
      if (attempt === attempts || !isRetryable(status)) break;
      // 2s puis 6s : assez pour laisser retomber un pic sans faire exploser la
      // durée d'exécution de la fonction.
      const wait = 2000 * Math.pow(3, attempt - 1);
      console.warn(
        `[NBA-SCHEDULE] CDN ${lastError.message} — nouvelle tentative ${attempt + 1}/${attempts} dans ${wait}ms`
      );
      await delay(wait);
    }
  }

  if (fallbackSeason) {
    console.warn(
      `[NBA-SCHEDULE] CDN indisponible (${lastError.message}) — repli sur stats.nba.com pour ${fallbackSeason}`
    );
    return (await fetchJson(statsUrl(fallbackSeason), NBA_STATS_HEADERS, timeoutMs)) as T;
  }

  throw lastError;
}

/** `leagueSchedule.seasonYear`, ou `null` s'il est illisible. */
export function readSeasonYear(schedule: unknown): string | null {
  const year = (schedule as { leagueSchedule?: { seasonYear?: unknown } })?.leagueSchedule
    ?.seasonYear;
  return typeof year === "string" && /^\d{4}-\d{2}$/.test(year) ? year : null;
}
