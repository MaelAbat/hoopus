import { BR_TRICODE_MAP, normalizeName } from "./br-salaries";
import { fetchBrHtml, isNotFound } from "./br-fetch";

/**
 * Termes des contrats, depuis Basketball Reference.
 *
 * `/contracts/{TRI}.html` donne, pour chaque joueur sous contrat, le montant dû
 * saison par saison (colonnes `y1` à `y6`, dont les en-têtes nomment la saison) et
 * le total garanti restant. C'est la seule source automatisable trouvée pour
 * répondre à « combien » — ni Basketball Reference ni ESPN ne chiffrent leurs
 * lignes de transactions, aucune des 268 entrées ESPN de 2026 ne mentionnant le
 * moindre montant.
 *
 * Limite à garder en tête : la page décrit les contrats **en cours**, pas ceux
 * signés autrefois. Un contrat lu ici correspond à la signature qui vient d'avoir
 * lieu, mais ne dira jamais ce qu'un joueur avait signé en 2017.
 */

export interface ContractYear {
  season: string;
  amount: number;
}

export interface PlayerContract {
  team_tricode: string;
  player_name: string;
  br_slug: string | null;
  /** Montants à venir, de la saison en cours vers la dernière année due. */
  years: ContractYear[];
  /** Total garanti restant, tel que BR le publie. */
  guaranteed: number | null;
}

export function contractsPageUrl(brTeam: string): string {
  return `https://www.basketball-reference.com/contracts/${brTeam}.html`;
}

function text(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function money(value: string): number | null {
  const match = value.match(/\$([\d,]+)/);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/**
 * Saisons annoncées par les en-têtes des colonnes `y1`…`y6`.
 *
 * Elles sont lues et non calculées : la colonne `y1` glisse d'une saison à
 * l'autre au fil de l'année, et c'est précisément ce glissement qui avait fait
 * ranger des salaires 2026-27 sous 2025-26 (voir br-salaries.ts).
 */
export function parseContractSeasons(html: string): Map<string, string> {
  const seasons = new Map<string, string>();
  for (const match of html.matchAll(/<th[^>]*data-stat="(y\d)"[^>]*>([^<]*)</g)) {
    const label = match[2].trim();
    if (/^\d{4}-\d{2}$/.test(label)) seasons.set(match[1], label);
  }
  return seasons;
}

/** Contrats d'une page d'équipe. */
export function parseContractsPage(html: string, nbaTricode: string): PlayerContract[] {
  const seasons = parseContractSeasons(html);
  if (seasons.size === 0) return [];

  const contracts: PlayerContract[] = [];

  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    const cells = new Map<string, string>();
    for (const cell of row.matchAll(/<(t[hd])\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      const stat = cell[2].match(/data-stat="([a-z0-9_]+)"/)?.[1];
      if (stat) cells.set(stat, cell[3]);
    }

    const playerCell = cells.get("player");
    const name = text(playerCell);
    // La ligne de totaux porte le même `data-stat` que les joueurs.
    if (!name || /team totals/i.test(name)) continue;

    const years: ContractYear[] = [];
    for (const [column, season] of seasons) {
      const amount = money(text(cells.get(column)));
      if (amount) years.push({ season, amount });
    }
    if (years.length === 0) continue;

    contracts.push({
      team_tricode: nbaTricode,
      player_name: name,
      br_slug: (playerCell ?? "").match(/href="\/players\/[a-z]\/([a-z0-9]+)\.html"/)?.[1] ?? null,
      years,
      guaranteed: money(text(cells.get("remain_gtd"))),
    });
  }

  return contracts;
}

/** Contrats d'une équipe. Renvoie un tableau vide si la page est absente. */
export async function fetchTeamContracts(brTeam: string): Promise<PlayerContract[]> {
  const nba = BR_TRICODE_MAP[brTeam] || brTeam;
  try {
    return parseContractsPage(await fetchBrHtml(contractsPageUrl(brTeam)), nba);
  } catch (err) {
    if (isNotFound(err)) {
      console.warn(`[BR-CONTRACTS] ${nba} : page absente`);
      return [];
    }
    throw err;
  }
}

/**
 * Durée et valeur d'un contrat, dites en français.
 *
 * On compte les années restantes dues, pas la durée d'origine : la source ne
 * connaît que l'avenir d'un contrat. « 3 ans, 87,0 M$ garantis ».
 */
export function contractTerms(contract: {
  years: ContractYear[];
  guaranteed: number | null;
}): string {
  const seasons = contract.years.length;
  const total = contract.years.reduce((sum, y) => sum + y.amount, 0);
  const duration = seasons > 1 ? `${seasons} ans` : "1 an";

  // Le garanti est souvent inférieur au total dû : options joueur, années non
  // garanties. Le préciser évite d'annoncer comme acquis ce qui ne l'est pas.
  const guaranteed = contract.guaranteed;
  const partial = guaranteed !== null && guaranteed < total * 0.98;
  return partial
    ? `${duration} · ${formatMillions(total)} dont ${formatMillions(guaranteed)} garantis`
    : `${duration} · ${formatMillions(total)}`;
}

/** « 52,6 M$ », ou « 875 k$ » sous le million. */
export function formatMillions(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace(".", ",")} M$`;
  }
  return `${Math.round(amount / 1000)} k$`;
}

/** Clé de rapprochement d'un contrat avec un mouvement : nom normalisé. */
export function contractKey(playerName: string): string {
  return normalizeName(playerName);
}
