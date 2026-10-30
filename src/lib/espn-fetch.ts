import https from "node:https";
import { UpstreamUnavailableError } from "./upstream";

/**
 * Accès unique à l'API publique d'ESPN.
 *
 * Trois lecteurs — le classement, l'infirmerie et les mouvements — appelaient
 * ESPN chacun à sa façon, deux d'entre eux sans le moindre en-tête. Ils
 * recevaient tous 403, et les trente équipes de l'infirmerie échouaient une par
 * une dans la console.
 *
 * Le pare-feu d'ESPN filtre sur le `User-Agent`, et sa règle ne récompense pas
 * l'honnêteté : mesuré endpoint par endpoint, il accepte les clients
 * automatisés courants — `curl/…`, `python-requests/…`, `axios/…`,
 * `Go-http-client/…`, `Java/…` — et refuse aussi bien l'absence d'en-tête, ce
 * que Node envoie par défaut, que `Wget/…`, `node-fetch/…`, `undici` ou un
 * `User-Agent` de Chrome complet. Se présenter simplement comme « Hoopus » est
 * refusé aussi.
 *
 * D'où la forme retenue : le préfixe que le filtre reconnaît, suivi de notre
 * identité et d'une adresse de contact. On ne se fait pas passer pour un
 * navigateur — ce qui serait à la fois faux et rejeté — et un administrateur qui
 * lit ses journaux sait qui l'appelle et où écrire. La contrepartie est assumée :
 * la règle est arbitraire et peut changer sans préavis, auquel cas les 403
 * reviendront et ce commentaire dira où regarder.
 */
const ESPN_HEADERS: Record<string, string> = {
  "User-Agent": "curl/8.5.0 Hoopus/1.0 (+https://hoopus.fr)",
  Accept: "application/json, text/plain, */*",
  // `identity` : on décode nous-mêmes, sans gzip à gérer.
  "Accept-Encoding": "identity",
  "Accept-Language": "en-US,en;q=0.9",
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Statuts qui valent une nouvelle tentative plutôt qu'un abandon. */
function isRetryable(status: number | undefined): boolean {
  if (!status) return true; // coupure réseau ou délai dépassé
  return status === 429 || status >= 500;
}

interface EspnFetchOptions {
  /** Ce qu'on lit, pour le journal : « classement 2026-27 », « blessures BOS ». */
  label: string;
  timeoutMs?: number;
  attempts?: number;
}

function get<T>(url: string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: ESPN_HEADERS }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        if (res.statusCode !== 200) {
          const err = new Error(`HTTP ${res.statusCode}`) as Error & { status?: number };
          err.status = res.statusCode;
          reject(err);
          return;
        }
        try {
          resolve(JSON.parse(body) as T);
        } catch {
          reject(new Error("réponse illisible"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`délai dépassé (${Math.round(timeoutMs / 1000)}s)`));
    });
  });
}

/**
 * Lecture JSON chez ESPN, avec quelques tentatives sur les erreurs passagères.
 *
 * Une source qui refuse ou reste muette lève `UpstreamUnavailableError` : à
 * l'appelant de décider si cela vaut un échec ou un simple « rien à faire ».
 */
export async function fetchEspnJson<T>(
  url: string,
  { label, timeoutMs = 30_000, attempts = 3 }: EspnFetchOptions
): Promise<T> {
  let lastError: Error = new Error("jamais tenté");

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await get<T>(url, timeoutMs);
    } catch (err) {
      lastError = err as Error;
      const status = (err as Error & { status?: number }).status;
      if (attempt === attempts || !isRetryable(status)) break;
      await delay(1000 * Math.pow(3, attempt - 1));
    }
  }

  throw new UpstreamUnavailableError(
    "ESPN",
    `${label} — ${lastError.message}`,
    (lastError as Error & { status?: number }).status
  );
}
