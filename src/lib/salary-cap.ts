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

/**
 * Seuils officiels par saison. Les échanges et la masse salariale sont
 * évalués avec les seuils de la saison affichée.
 */
const THRESHOLDS_BY_SEASON: Record<string, CapThresholds> = {
  "2025-26": {
    salaryCap: 154_647_000,
    luxuryTax: 188_931_000,
    firstApron: 196_581_000,
    secondApron: 204_231_000,
  },
  "2024-25": {
    salaryCap: 140_588_000,
    luxuryTax: 170_814_000,
    firstApron: 178_132_000,
    secondApron: 188_931_000,
  },
};

const LATEST_SEASON = "2025-26";

/** Seuils de la saison la plus récente — valeur par défaut. */
export const CAP_THRESHOLDS = THRESHOLDS_BY_SEASON[LATEST_SEASON];

/** Seuils d'une saison donnée, avec repli sur la saison la plus récente. */
export function capThresholds(season: string): CapThresholds {
  return THRESHOLDS_BY_SEASON[season] ?? CAP_THRESHOLDS;
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
