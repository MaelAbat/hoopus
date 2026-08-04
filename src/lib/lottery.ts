/**
 * Grille de la loterie.
 *
 * Aucune source ne publie le résultat d'un tirage : Basketball Reference n'a pas
 * de page de loterie et la NBA n'expose rien. La grille se reconstruit donc à
 * partir du classement de la saison écoulée — que le site possède déjà — et des
 * probabilités officielles de l'époque.
 *
 * Ce qui se démontre est calculé ; le reste ne l'est pas :
 *
 *   * Les quatorze équipes concernées sont celles qui n'ont pas atteint les
 *     playoffs. On ne les déduit pas des bilans : depuis toujours, une équipe
 *     peut manquer les playoffs avec un meilleur bilan qu'une qualifiée de
 *     l'autre conférence.
 *   * Le rang avant tirage vient du bilan, du pire au meilleur. Les égalités sont
 *     signalées : la ligue les tranche par un tirage au sort dont le résultat ne
 *     figure nulle part.
 *   * Le mouvement réel de chaque équipe à l'issue du tirage n'est PAS calculé.
 *     L'ordre des choix est connu, mais un choix peut avoir été échangé et rien
 *     n'indique son propriétaire d'origine. Prétendre le contraire serait
 *     inventer.
 */

/**
 * Réforme de 2019 : les trois pires bilans partagent la même chance d'obtenir le
 * premier choix, pour décourager les saisons sabordées.
 */
const ODDS_FLAT_FROM = 2019;

/** Probabilités du premier choix, en pourcentage, du pire bilan au quatorzième. */
const ODDS_SINCE_2019 = [14, 14, 14, 12.5, 10.5, 9, 7.5, 6, 4.5, 3, 2.5, 2, 1.5, 0.5];
const ODDS_2005_2018 = [25, 19.9, 15.6, 11.9, 8.8, 6.3, 4.3, 2.8, 1.7, 1.1, 0.8, 0.7, 0.6, 0.5];

/**
 * Chance d'obtenir le premier choix pour un rang donné, `null` hors des grilles
 * connues. Les drafts antérieures à 2005 ne sont pas couvertes : l'historique du
 * site commence en 2015-16.
 */
export function lotteryOdds(draftYear: number, preLotteryRank: number): number | null {
  if (preLotteryRank < 1 || preLotteryRank > 14) return null;
  if (draftYear < 2005) return null;
  const grid = draftYear >= ODDS_FLAT_FROM ? ODDS_SINCE_2019 : ODDS_2005_2018;
  return grid[preLotteryRank - 1] ?? null;
}

export interface StandingsRow {
  team_tricode: string;
  wins: number;
  losses: number;
}

export interface LotteryRow {
  draft_year: number;
  team_tricode: string;
  from_season: string;
  pre_lottery_rank: number;
  wins: number;
  losses: number;
  odds_top1: number | null;
  tied: boolean;
}

/**
 * Grille d'une loterie : les équipes non qualifiées, classées du pire bilan au
 * meilleur, avec leurs probabilités.
 *
 * `playoffTeams` doit contenir les équipes ayant disputé les playoffs. Une liste
 * vide donne une grille vide plutôt qu'une grille fausse : sans elle, impossible
 * de distinguer une non-qualifiée d'une équipe éliminée au premier tour.
 */
export function buildLotteryBoard({
  fromSeason,
  draftYear,
  standings,
  playoffTeams,
}: {
  fromSeason: string;
  draftYear: number;
  standings: StandingsRow[];
  playoffTeams: Set<string>;
}): LotteryRow[] {
  if (playoffTeams.size === 0) return [];

  const eliminated = standings.filter((row) => !playoffTeams.has(row.team_tricode));

  const winPct = (row: StandingsRow) => {
    const games = row.wins + row.losses;
    return games > 0 ? row.wins / games : 0;
  };

  const sorted = [...eliminated].sort(
    (a, b) => winPct(a) - winPct(b) || a.team_tricode.localeCompare(b.team_tricode)
  );

  return sorted.map((row, index) => {
    const rank = index + 1;
    const tied = sorted.some((other) => other !== row && winPct(other) === winPct(row));
    return {
      draft_year: draftYear,
      team_tricode: row.team_tricode,
      from_season: fromSeason,
      pre_lottery_rank: rank,
      wins: row.wins,
      losses: row.losses,
      odds_top1: lotteryOdds(draftYear, rank),
      tied,
    };
  });
}
