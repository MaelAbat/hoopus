/**
 * Repères de masse salariale NBA — seuils par saison, formatage et statut cap.
 *
 * Source unique partagée par /equipes (masse salariale) et /trades
 * (trade machine), afin que les deux pages affichent les mêmes seuils.
 */

export interface CapThresholds {
  /** Plafond salarial (salary cap). */
  salaryCap: number;
  /** Seuil de luxury tax. */
  luxuryTax: number;
  /** Premier apron. */
  firstApron: number;
  /** Second apron. */
  secondApron: number;
}

export interface SeasonThresholds extends CapThresholds {
  season: string;
  /**
   * Vrai quand les montants sont projetés et non annoncés. La ligue publie ses
   * seuils début juillet ; d'ici là, la saison à venir n'a que des estimations.
   */
  isEstimated: boolean;
}

/**
 * Seuils officiels connus, amorce de la table `salary_cap_levels`.
 *
 * Cette liste n'a pas besoin d'être complétée chaque année : une saison absente
 * est projetée (voir `resolveThresholds`) et la valeur réelle se corrige par une
 * ligne en base, sans toucher au code ni redéployer.
 *
 * Sources : annonces de la ligue, début juillet de chaque année.
 */
export const KNOWN_THRESHOLDS: Record<string, CapThresholds> = {
  "2025-26": {
    salaryCap: 154_647_000,
    luxuryTax: 187_895_000,
    firstApron: 195_945_000,
    secondApron: 207_824_000,
  },
  "2024-25": {
    salaryCap: 140_588_000,
    luxuryTax: 170_814_000,
    firstApron: 178_132_000,
    secondApron: 188_931_000,
  },
};

/**
 * Rapports des trois seuils au plafond salarial.
 *
 * La convention collective ne fixe pas ces montants indépendamment : ce sont des
 * pourcentages du plafond. Vérifié sur les trois saisons dont la ligue a publié
 * les quatre valeurs (2023-24, 2024-25, 2025-26), les rapports sont constants à
 * la cinquième décimale.
 *
 * Conséquence pratique : il suffit de connaître le plafond — que Basketball
 * Reference publie, saison à venir comprise — pour en déduire le reste. Ce n'est
 * donc pas une estimation mais un calcul.
 */
export const CAP_RATIOS = {
  luxuryTax: 1.215,
  firstApron: 1.26705,
  secondApron: 1.343863,
} as const;

/** Les quatre seuils déduits d'un plafond, arrondis au millier. */
export function thresholdsFromCap(salaryCap: number): CapThresholds {
  const round = (n: number) => Math.round(n / 1000) * 1000;
  return {
    salaryCap: round(salaryCap),
    luxuryTax: round(salaryCap * CAP_RATIOS.luxuryTax),
    firstApron: round(salaryCap * CAP_RATIOS.firstApron),
    secondApron: round(salaryCap * CAP_RATIOS.secondApron),
  };
}

/**
 * Première saison dotée d'un second apron (convention 2023). Avant elle, déduire
 * un apron du plafond n'aurait aucun sens.
 */
export const FIRST_APRON_SEASON_START_YEAR = 2023;

/**
 * Hausse annuelle retenue pour projeter une saison inconnue.
 *
 * La convention collective plafonne la progression du cap à 10 % par an, et les
 * quatre seuils ont progressé exactement de ce taux entre 2024-25 et 2025-26
 * (140,588 → 154,647 ; 170,814 → 187,895 ; 178,132 → 195,945 ; 188,931 →
 * 207,824). C'est donc une borne haute, pas une certitude : une année maigre
 * progresse moins. D'où le marquage « estimé » jusqu'à correction.
 */
export const MAX_ANNUAL_CAP_GROWTH = 1.1;

/** Projette des seuils sur `years` saisons, au taux maximal de la convention. */
export function projectThresholds(from: CapThresholds, years: number): CapThresholds {
  const factor = Math.pow(MAX_ANNUAL_CAP_GROWTH, years);
  const round = (n: number) => Math.round((n * factor) / 1000) * 1000;
  return {
    salaryCap: round(from.salaryCap),
    luxuryTax: round(from.luxuryTax),
    firstApron: round(from.firstApron),
    secondApron: round(from.secondApron),
  };
}

/**
 * Seuils d'une saison, exacts si connus, projetés sinon.
 *
 * Aucun repli silencieux : une saison sans montants annoncés reçoit une
 * projection explicitement marquée, que l'interface signale. L'ancien
 * comportement — servir les seuils de la dernière saison connue comme s'ils
 * étaient ceux de la saison demandée — faussait les verdicts d'échange sans
 * que rien ne l'indique.
 */
export function resolveThresholds(
  season: string,
  known: Record<string, CapThresholds> = KNOWN_THRESHOLDS
): SeasonThresholds {
  const exact = known[season];
  if (exact) return { season, ...exact, isEstimated: false };

  const target = parseInt(season.split("-")[0], 10);
  const years = Object.keys(known)
    .map((s) => parseInt(s.split("-")[0], 10))
    .filter((y) => Number.isFinite(y));

  if (years.length === 0) {
    // Aucune référence : on ne peut rien affirmer.
    return {
      season,
      salaryCap: 0,
      luxuryTax: 0,
      firstApron: 0,
      secondApron: 0,
      isEstimated: true,
    };
  }

  // On projette depuis la saison connue la plus proche en amont ; si la saison
  // demandée précède tout ce qu'on connaît, on part de la plus ancienne.
  const earlier = years.filter((y) => y <= target);
  const baseYear = earlier.length > 0 ? Math.max(...earlier) : Math.min(...years);
  const baseSeason = Object.keys(known).find(
    (s) => parseInt(s.split("-")[0], 10) === baseYear
  )!;

  return {
    season,
    ...projectThresholds(known[baseSeason], target - baseYear),
    isEstimated: true,
  };
}

/** Seuils de la saison connue la plus récente — dernier recours. */
export const CAP_THRESHOLDS: CapThresholds =
  KNOWN_THRESHOLDS[
    Object.keys(KNOWN_THRESHOLDS).reduce((a, b) =>
      parseInt(b, 10) > parseInt(a, 10) ? b : a
    )
  ];

/** Seuils d'une saison donnée. Conservé pour les appels purs (tests, scripts). */
export function capThresholds(season: string): CapThresholds {
  const { salaryCap, luxuryTax, firstApron, secondApron } = resolveThresholds(season);
  return { salaryCap, luxuryTax, firstApron, secondApron };
}

/** `"$51,915,615"` → `51915615`. Renvoie 0 si le salaire est absent. */
export function parseSalary(salary: string | null | undefined): number {
  if (!salary) return 0;
  return Number(salary.replace(/[$,]/g, "")) || 0;
}

/**
 * Comme `parseSalary`, mais distingue « salaire inconnu » (null) de
 * « salaire nul » — la trade machine doit signaler les contrats manquants
 * plutôt que de les compter comme 0 $.
 */
export function parseSalaryOrNull(salary: string | null | undefined): number | null {
  if (!salary) return null;
  const n = Number(salary.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** `51915615` → `"$51.9M"`. */
export function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs}`;
}

/** Comme `formatMoney`, mais force le signe — utilisé pour les variations. */
export function formatMoneyDelta(n: number): string {
  if (n === 0) return "$0";
  return `${n > 0 ? "+" : ""}${formatMoney(n)}`;
}

export type CapStatusKey = "under" | "over" | "tax" | "apron1" | "apron2";

export interface CapStatusInfo {
  key: CapStatusKey;
  label: string;
  /** Classe de couleur de texte. */
  color: string;
  /** Classe de remplissage de barre. */
  barFill: string;
  /** Classes de bordure + texte pour le badge. */
  badge: string;
}

/** Situation d'une équipe par rapport aux seuils, du plus haut au plus bas. */
export function capStatus(total: number, t: CapThresholds = CAP_THRESHOLDS): CapStatusInfo {
  if (total >= t.secondApron)
    return { key: "apron2", label: "2nd Apron", color: "text-red-500", barFill: "bg-red-500", badge: "border-red-500 text-red-500" };
  if (total >= t.firstApron)
    return { key: "apron1", label: "1er Apron", color: "text-accent-text", barFill: "bg-accent", badge: "border-accent text-accent-text" };
  if (total >= t.luxuryTax)
    return { key: "tax", label: "Luxury Tax", color: "text-text-primary", barFill: "bg-accent/70", badge: "border-rule text-text-primary" };
  if (total >= t.salaryCap)
    return { key: "over", label: "Over Cap", color: "text-text-secondary", barFill: "bg-text-muted", badge: "border-rule text-text-secondary" };
  return { key: "under", label: "Under Cap", color: "text-text-muted", barFill: "bg-text-faint", badge: "border-rule text-text-muted" };
}

/** Nombre de franchises actives — repère pour juger une série de données complète. */
export const NBA_TEAM_COUNT = 30;
