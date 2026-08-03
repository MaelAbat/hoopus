import https from "node:https";

/**
 * Historique des plafonds salariaux, depuis Basketball Reference.
 *
 * `/contracts/salary-cap-history.html` publie le plafond de chaque saison,
 * **saison à venir comprise** : c'est la seule source automatisable trouvée pour
 * un montant que la ligue annonce début juillet.
 *
 * La page ne contient ni luxury tax ni aprons — seulement `year_id` et `cap`.
 * Ces trois seuils se déduisent du plafond par les rapports fixes de la
 * convention (voir `CAP_RATIOS` dans salary-cap.ts).
 *
 * Note : Basketball Reference refuse les requêtes venant d'IP de datacenter
 * (403). Cette lecture n'aboutit donc que depuis une machine « ordinaire »,
 * ce qui inclut les fonctions Vercel mais pas n'importe quel proxy.
 */

const URL_CAP_HISTORY = "https://www.basketball-reference.com/contracts/salary-cap-history.html";

function fetchHtml(url: string): Promise<string> {
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
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`cap history: HTTP ${res.statusCode}`));
            return;
          }
          resolve(Buffer.concat(chunks).toString("utf-8"));
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(45000, () => {
      req.destroy();
      reject(new Error("cap history: timeout"));
    });
  });
}

/** Extrait les couples saison → plafond d'un document déjà récupéré. */
export function parseCapHistory(html: string): Map<string, number> {
  const caps = new Map<string, number>();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];

  for (const row of rows) {
    const season = row.match(/data-stat="year_id"[^>]*>(?:<[^>]*>)*(\d{4}-\d{2})/);
    if (!season) continue;
    // La colonne `cap2022` corrige de l'inflation : on ne veut pas la confondre
    // avec le plafond nominal, d'où l'ancrage exact sur `cap`.
    const cap = row.match(/data-stat="cap"[^>]*>(?:<[^>]*>)*\$([\d,]+)/);
    if (!cap) continue;
    const amount = Number(cap[1].replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) caps.set(season[1], amount);
  }

  return caps;
}

/** Plafonds publiés, par saison. Vide si la page est injoignable. */
export async function fetchCapHistory(): Promise<Map<string, number>> {
  try {
    const caps = parseCapHistory(await fetchHtml(URL_CAP_HISTORY));
    console.log(`[BR-CAP] ${caps.size} plafonds lus`);
    return caps;
  } catch (err) {
    console.error("[BR-CAP] Lecture impossible:", (err as Error).message);
    return new Map();
  }
}
