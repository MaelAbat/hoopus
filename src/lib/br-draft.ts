import { BR_TRICODE_MAP } from "./br-salaries";
import { fetchBrHtml, isNotFound } from "./br-fetch";
import { seasonFromStartYear } from "./season";

/**
 * Résultats de draft, depuis Basketball Reference.
 *
 * Une page par draft, `draft/NBA_{année}.html`, l'année étant celle du tirage :
 * `NBA_2025.html` donne bien la draft de juin 2025, celle de Cooper Flagg.
 *
 * Les tours ne sont pas une colonne mais un intertitre (« Round 1 », « Round 2 »)
 * inséré dans le tableau. Ils se lisent donc dans l'ordre du document. Et le
 * nombre de choix varie : une draft peut en compter moins de soixante, la ligue
 * retirant des choix à titre de sanction.
 */

export interface DraftPickRow {
  draft_year: number;
  /** Saison que cette draft ouvre : la draft 2025 alimente 2025-26. */
  season: string;
  pick_overall: number;
  round: number;
  pick_in_round: number | null;
  team_tricode: string;
  /**
   * Nul pour un choix non exercé : la ligue retire parfois un choix à une
   * équipe, et le rang existe alors sans joueur. L'effacer serait perdre une
   * sanction ; l'inventer serait pire.
   */
  player_name: string | null;
  br_slug: string | null;
  college: string | null;
}

export function draftPageUrl(year: number): string {
  return `https://www.basketball-reference.com/draft/NBA_${year}.html`;
}

/** Cellules d'une ligne, indexées par `data-stat`. */
function cells(row: string): Map<string, string> {
  const map = new Map<string, string>();
  const cell = /<(t[hd])\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = cell.exec(row)) !== null) {
    const stat = match[2].match(/data-stat="([a-z0-9_]+)"/)?.[1];
    if (stat) map.set(stat, match[3]);
  }
  return map;
}

function text(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tous les choix d'une page de draft, dans l'ordre. */
export function parseDraftPage(html: string, year: number): DraftPickRow[] {
  const picks: DraftPickRow[] = [];
  const season = seasonFromStartYear(year);
  let round = 1;
  let pickInRound = 0;

  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    // Intertitre de tour : il ouvre le tour suivant et remet le compteur à zéro.
    const roundHeader = row.match(/>\s*Round\s+(\d+)\s*</);
    if (roundHeader) {
      round = Number(roundHeader[1]);
      pickInRound = 0;
      continue;
    }

    const cell = cells(row);
    const overall = Number(text(cell.get("pick_overall")));
    if (!Number.isFinite(overall) || overall <= 0) continue;

    // L'équipe fait office de garde-fou : une ligne de mise en forme n'en a pas,
    // un choix non exercé si. Le joueur, lui, peut manquer légitimement.
    const brTeam = text(cell.get("team_id"));
    if (!/^[A-Z]{3}$/.test(brTeam)) continue;

    const playerCell = cell.get("player") ?? "";
    const playerName = text(playerCell) || null;

    pickInRound++;
    picks.push({
      draft_year: year,
      season,
      pick_overall: overall,
      round,
      pick_in_round: pickInRound,
      team_tricode: BR_TRICODE_MAP[brTeam] || brTeam,
      player_name: playerName,
      br_slug: playerCell.match(/href="\/players\/[a-z]\/([a-z0-9]+)\.html"/)?.[1] ?? null,
      college: text(cell.get("college_name")) || null,
    });
  }

  return picks;
}

/**
 * Choix d'une draft. Renvoie un tableau vide si la page n'existe pas encore —
 * une draft à venir n'est pas une erreur.
 */
export async function fetchDraft(year: number): Promise<DraftPickRow[]> {
  try {
    return parseDraftPage(await fetchBrHtml(draftPageUrl(year)), year);
  } catch (err) {
    if (isNotFound(err)) {
      console.warn(`[BR-DRAFT] draft ${year} : page absente`);
      return [];
    }
    throw err;
  }
}
