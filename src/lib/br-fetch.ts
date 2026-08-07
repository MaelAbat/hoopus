import https from "node:https";

/**
 * Lecture polie de Basketball Reference.
 *
 * BR tolère une vingtaine de requêtes par minute et répond 429 au-delà, avec un
 * blocage qui dure. Les modules qui lisent BR partagent donc la même discipline :
 * séquentiel, espacé, avec reprise sur limitation.
 *
 * Un 404 n'est pas une erreur passagère mais une information : « page pas encore
 * publiée ». Il ne doit jamais être réessayé, et l'appelant doit pouvoir le
 * distinguer — d'où le statut porté par l'erreur.
 *
 * Note : BR refuse les requêtes venant d'IP de datacenter (403). Ces lectures
 * aboutissent depuis les fonctions Vercel, pas depuis n'importe quel proxy.
 */

/** Intervalle à respecter entre deux requêtes séquentielles. */
export const BR_REQUEST_INTERVAL_MS = 3200;

/** Tentatives par page en cas de limitation de débit. */
const ATTEMPTS = 3;

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type HttpError = Error & { status?: number };

function fetchOnce(url: string, redirects = 0): Promise<string> {
  if (redirects > 5) return Promise.reject(new Error("trop de redirections"));
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          let location = res.headers.location;
          if (location.startsWith("/")) {
            const parsed = new URL(url);
            location = `${parsed.protocol}//${parsed.host}${location}`;
          }
          res.resume();
          fetchOnce(location, redirects + 1).then(resolve, reject);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            const err = new Error(`BR: HTTP ${res.statusCode}`) as HttpError;
            err.status = res.statusCode;
            reject(err);
            return;
          }
          resolve(Buffer.concat(chunks).toString("utf-8"));
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(45000, () => {
      req.destroy();
      reject(new Error("BR: délai dépassé"));
    });
  });
}

/** Lecture avec reprise sur limitation de débit. Un 404 remonte immédiatement. */
export async function fetchBrHtml(url: string): Promise<string> {
  let lastError: HttpError = new Error("jamais tenté");

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await fetchOnce(url);
    } catch (err) {
      lastError = err as HttpError;
      const status = lastError.status;
      const retryable = !status || status === 429 || status === 403 || status >= 500;
      if (attempt === ATTEMPTS || !retryable) throw err;
      // 4s puis 12s : une limitation de débit se dissipe en quelques secondes.
      const wait = 4000 * Math.pow(3, attempt - 1);
      console.warn(`[BR] ${lastError.message} — tentative ${attempt + 1}/${ATTEMPTS} dans ${wait}ms`);
      await delay(wait);
    }
  }

  throw lastError;
}

/** Vrai si l'erreur signale une page absente (et non une limitation). */
export function isNotFound(err: unknown): boolean {
  return (err as HttpError)?.status === 404;
}
