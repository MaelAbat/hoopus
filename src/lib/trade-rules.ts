/**
 * Moteur de validation des échanges NBA (CBA 2023).
 *
 * Modèle volontairement simplifié, mais explicite : chaque verdict renvoie la
 * règle qui a été appliquée, pour que l'utilisateur puisse vérifier le calcul.
 *
 * Règles couvertes
 * ────────────────
 *   1. Concordance salariale, selon la position de l'équipe APRÈS l'échange :
 *        - sous le plafond  → absorption dans l'espace disponible
 *        - au-dessus du plafond, sous le 1er apron → 125 % + 250 000 $
 *          (avec plafonnement dur au 1er apron)
 *        - au-dessus du 1er apron → dollar pour dollar (100 %)
 *   2. Second apron : interdiction d'agréger plusieurs contrats sortants
 *      pour absorber un salaire entrant.
 *   3. Effectif : limite de 15 joueurs, minimum de 14.
 *
 * Non couvert (données absentes) : exceptions de trade des saisons
 * antérieures, clauses de non-échange, droits de veto, tours de draft,
 * délais post-signature, joueurs two-way, restrictions Bird.
 */

import { capThresholds, type CapThresholds } from "./salary-cap";

/** Limite de joueurs sous contrat standard. */
export const ROSTER_MAX = 15;
/** Minimum de joueurs qu'une équipe doit conserver. */
export const ROSTER_MIN = 14;
/** Marge additionnelle de la règle des 125 %. */
export const TPE_CUSHION = 250_000;

export interface TradeRosterPlayer {
  player_id: number;
  first_name: string;
  last_name: string;
  team_tricode: string;
  team_city: string;
  team_name: string;
  position: string;
  age: number | null;
  /** Salaire en dollars. `null` = contrat inconnu (donnée manquante). */
  salary: number | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
}

/** Un joueur placé dans l'échange : d'où il part, où il va. */
export interface TradeMove {
  playerId: number;
  from: string;
  to: string;
}

export type IssueLevel = "error" | "warning";

export interface TradeIssue {
  level: IssueLevel;
  message: string;
}

export type MatchRuleKey = "cap-space" | "tpe-125" | "apron-100" | "none";

export interface SalaryMatchRule {
  key: MatchRuleKey;
  /** Salaire entrant maximal autorisé, en dollars. */
  limit: number;
  label: string;
}

export interface TeamTradeSummary {
  tricode: string;
  city: string;
  name: string;
  outgoing: TradeRosterPlayer[];
  incoming: TradeRosterPlayer[];
  /** Total des salaires sortants (les contrats inconnus comptent pour 0). */
  outgoingSalary: number;
  incomingSalary: number;
  /** Nombre de contrats inconnus de part et d'autre. */
  unknownOutgoing: number;
  unknownIncoming: number;
  payrollBefore: number;
  payrollAfter: number;
  /** Marge avant le plafond / les aprons, après l'échange. */
  capRoomAfter: number;
  taxRoomAfter: number;
  firstApronRoomAfter: number;
  secondApronRoomAfter: number;
  rosterBefore: number;
  rosterAfter: number;
  /** Règle de concordance salariale retenue (la plus favorable). */
  matchRule: SalaryMatchRule;
  /** Production sortante / entrante, en moyenne par match. */
  ptsOut: number;
  ptsIn: number;
  rebOut: number;
  rebIn: number;
  astOut: number;
  astIn: number;
  /** Indice de production composite (voir `productionIndex`). */
  productionOut: number;
  productionIn: number;
  /** Âge moyen de l'effectif avant / après. */
  ageBefore: number | null;
  ageAfter: number | null;
  issues: TradeIssue[];
}

export type TradeVerdict = "empty" | "valid" | "invalid" | "incomplete";

export interface TradeEvaluation {
  verdict: TradeVerdict;
  teams: TeamTradeSummary[];
  /** Problèmes qui ne concernent pas une équipe en particulier. */
  globalIssues: TradeIssue[];
  thresholds: CapThresholds;
  /** Vrai si au moins un contrat impliqué est inconnu. */
  hasUnknownSalaries: boolean;
}

/**
 * Indice de production composite — un repère unique pour peser les deux côtés
 * d'un échange. Pondération classique des « points créés » : un rebond vaut
 * 1,2 point, une passe 1,5. Indicatif, pas une valeur de marché.
 */
export function productionIndex(p: Pick<TradeRosterPlayer, "pts" | "reb" | "ast">): number {
  return (p.pts ?? 0) + 1.2 * (p.reb ?? 0) + 1.5 * (p.ast ?? 0);
}

/**
 * Salaire entrant maximal autorisé pour une équipe, sur la base de son salaire
 * sortant. On retient la voie légale la plus favorable des trois.
 */
export function salaryMatchLimit(
  payrollBefore: number,
  outgoingSalary: number,
  t: CapThresholds
): SalaryMatchRule {
  // Masse salariale une fois les partants retirés — base de tous les calculs.
  const payrollAfterOut = payrollBefore - outgoingSalary;
  const capRoom = Math.max(0, t.salaryCap - payrollAfterOut);
  const apronRoom = Math.max(0, t.firstApron - payrollAfterOut);

  const options: SalaryMatchRule[] = [
    // Dollar pour dollar : toujours disponible, y compris au-dessus des aprons.
    {
      key: "apron-100",
      limit: outgoingSalary,
      label: "Dollar pour dollar (100 % du salaire sortant)",
    },
    // Règle des 125 % + 250 000 $, avec plafonnement dur au 1er apron : une
    // équipe qui l'utilise ne peut pas franchir cette ligne.
    {
      key: "tpe-125",
      limit: outgoingSalary > 0 ? Math.min(outgoingSalary * 1.25 + TPE_CUSHION, apronRoom) : 0,
      label: "125 % + 250 000 $ (plafonné au 1er apron)",
    },
    // Absorption dans l'espace disponible sous le plafond.
    {
      key: "cap-space",
      limit: outgoingSalary + capRoom,
      label: "Absorption dans l'espace sous le plafond",
    },
  ];

  const best = options.reduce((a, b) => (b.limit > a.limit ? b : a));
  if (best.limit <= 0) {
    return { key: "none", limit: 0, label: "Aucune marge — l'équipe ne peut rien recevoir" };
  }
  return best;
}

interface EvaluateInput {
  season: string;
  /** Équipes engagées dans l'échange (2 à 4). */
  teams: string[];
  moves: TradeMove[];
  /** Effectifs complets des équipes concernées. */
  roster: TradeRosterPlayer[];
  /** Masse salariale de départ par équipe (tricode → dollars). */
  payrollBase: Record<string, number>;
  /**
   * Seuils applicables. À fournir explicitement : les montants réels vivent en
   * base (table salary_cap_levels), pas dans le code, afin qu'une nouvelle
   * saison n'exige aucune modification de code. Omis, on retombe sur les
   * montants connus — acceptable pour les tests et les scripts uniquement.
   */
  thresholds?: CapThresholds;
}

/** Moyenne, ou `null` si aucune valeur exploitable. */
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function evaluateTrade({
  season,
  teams,
  moves,
  roster,
  payrollBase,
  thresholds: providedThresholds,
}: EvaluateInput): TradeEvaluation {
  const thresholds = providedThresholds ?? capThresholds(season);
  const byId = new Map(roster.map((p) => [p.player_id, p]));
  const globalIssues: TradeIssue[] = [];

  // Ne garder que les mouvements exploitables : joueur connu, équipes engagées,
  // et destination différente de l'origine.
  const valid = moves.filter((m) => {
    const p = byId.get(m.playerId);
    return p && m.from !== m.to && teams.includes(m.from) && teams.includes(m.to);
  });

  const summaries: TeamTradeSummary[] = teams.map((tricode) => {
    const teamRoster = roster.filter((p) => p.team_tricode === tricode);
    const sample = teamRoster[0];

    const outgoing = valid
      .filter((m) => m.from === tricode)
      .map((m) => byId.get(m.playerId)!)
      .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0));
    const incoming = valid
      .filter((m) => m.to === tricode)
      .map((m) => byId.get(m.playerId)!)
      .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0));

    const sum = (list: TradeRosterPlayer[]) => list.reduce((a, p) => a + (p.salary ?? 0), 0);
    const outgoingSalary = sum(outgoing);
    const incomingSalary = sum(incoming);

    const payrollBefore = payrollBase[tricode] ?? 0;
    const payrollAfter = payrollBefore - outgoingSalary + incomingSalary;

    const rosterBefore = teamRoster.length;
    const rosterAfter = rosterBefore - outgoing.length + incoming.length;

    const matchRule = salaryMatchLimit(payrollBefore, outgoingSalary, thresholds);

    // Âge moyen avant / après.
    const outIds = new Set(outgoing.map((p) => p.player_id));
    const agesBefore = teamRoster.map((p) => p.age).filter((a): a is number => a != null);
    const agesAfter = [
      ...teamRoster.filter((p) => !outIds.has(p.player_id)),
      ...incoming,
    ]
      .map((p) => p.age)
      .filter((a): a is number => a != null);

    const issues: TradeIssue[] = [];
    const teamLabel = tricode;

    if (outgoing.length === 0 && incoming.length === 0) {
      issues.push({
        level: "error",
        message: `${teamLabel} ne participe pas à l'échange — retirez l'équipe ou ajoutez un joueur.`,
      });
    }

    // ── Contrats inconnus ──
    // Un salaire manquant est compté pour 0 $, ce qui sous-estime les totaux.
    // Les règles salariales ne peuvent donc pas être opposables : on les
    // rétrograde en avertissement pour ne pas invalider un échange à tort.
    const unknownOutgoing = outgoing.filter((p) => p.salary == null).length;
    const unknownIncoming = incoming.filter((p) => p.salary == null).length;
    const unknownTotal = unknownOutgoing + unknownIncoming;
    const salaryLevel: IssueLevel = unknownTotal > 0 ? "warning" : "error";
    const caveat = unknownTotal > 0 ? " Contrats manquants : vérification indicative." : "";

    if (unknownTotal > 0) {
      issues.push({
        level: "warning",
        message:
          `${unknownTotal} contrat(s) inconnu(s) chez ${teamLabel} — comptés pour 0 $. ` +
          `La concordance salariale est donc incomplète.`,
      });
    }

    // ── Concordance salariale ──
    if (incomingSalary > 0) {
      // Tolérance d'un dollar pour absorber les arrondis.
      if (incomingSalary > matchRule.limit + 1) {
        const excess = incomingSalary - matchRule.limit;
        issues.push({
          level: salaryLevel,
          message:
            `${teamLabel} reçoit ${money(incomingSalary)} pour ${money(outgoingSalary)} envoyés. ` +
            `Maximum autorisé : ${money(matchRule.limit)} (${matchRule.label}). ` +
            `Dépassement de ${money(excess)}.${caveat}`,
        });
      }

      // ── Second apron : pas d'agrégation de contrats ──
      const overSecondApron = payrollAfter > thresholds.secondApron;
      if (overSecondApron && outgoing.length > 1) {
        issues.push({
          level: salaryLevel,
          message:
            `${teamLabel} est au-dessus du second apron après l'échange : impossible d'agréger ` +
            `${outgoing.length} contrats sortants pour absorber un salaire entrant.${caveat}`,
        });
      }
    }

    // ── Effectif ──
    // La table des effectifs recense tous les joueurs passés par la franchise
    // sur la saison : on avertit sans invalider l'échange.
    if (rosterAfter > ROSTER_MAX) {
      issues.push({
        level: "warning",
        message:
          `${teamLabel} monterait à ${rosterAfter} joueurs listés (limite de ${ROSTER_MAX} sous contrat standard).`,
      });
    } else if (rosterAfter < ROSTER_MIN) {
      issues.push({
        level: "warning",
        message:
          `${teamLabel} descendrait à ${rosterAfter} joueurs listés (minimum de ${ROSTER_MIN}) — la franchise devrait signer un joueur.`,
      });
    }

    return {
      tricode,
      city: sample?.team_city ?? tricode,
      name: sample?.team_name ?? "",
      outgoing,
      incoming,
      outgoingSalary,
      incomingSalary,
      unknownOutgoing,
      unknownIncoming,
      payrollBefore,
      payrollAfter,
      capRoomAfter: thresholds.salaryCap - payrollAfter,
      taxRoomAfter: thresholds.luxuryTax - payrollAfter,
      firstApronRoomAfter: thresholds.firstApron - payrollAfter,
      secondApronRoomAfter: thresholds.secondApron - payrollAfter,
      rosterBefore,
      rosterAfter,
      matchRule,
      ptsOut: outgoing.reduce((a, p) => a + (p.pts ?? 0), 0),
      ptsIn: incoming.reduce((a, p) => a + (p.pts ?? 0), 0),
      rebOut: outgoing.reduce((a, p) => a + (p.reb ?? 0), 0),
      rebIn: incoming.reduce((a, p) => a + (p.reb ?? 0), 0),
      astOut: outgoing.reduce((a, p) => a + (p.ast ?? 0), 0),
      astIn: incoming.reduce((a, p) => a + (p.ast ?? 0), 0),
      productionOut: outgoing.reduce((a, p) => a + productionIndex(p), 0),
      productionIn: incoming.reduce((a, p) => a + productionIndex(p), 0),
      ageBefore: average(agesBefore),
      ageAfter: average(agesAfter),
      issues,
    };
  });

  if (teams.length < 2) {
    globalIssues.push({ level: "error", message: "Sélectionnez au moins deux équipes." });
  }

  const hasUnknownSalaries = summaries.some((s) => s.unknownOutgoing + s.unknownIncoming > 0);
  const hasErrors =
    globalIssues.some((i) => i.level === "error") ||
    summaries.some((s) => s.issues.some((i) => i.level === "error"));

  let verdict: TradeVerdict;
  if (valid.length === 0) verdict = "empty";
  else if (hasErrors) verdict = "invalid";
  else if (hasUnknownSalaries) verdict = "incomplete";
  else verdict = "valid";

  return { verdict, teams: summaries, globalIssues, thresholds, hasUnknownSalaries };
}

/** Formatage court réutilisé dans les messages du moteur. */
function money(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)} M$`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)} k$`;
  return `${sign}${abs} $`;
}

/* ─── Encodage de l'échange dans l'URL (partage) ─── */

/** `?teams=BOS,LAL&moves=201143-LAL,1628369-BOS` */
export function encodeTrade(teams: string[], moves: TradeMove[]): string {
  const params = new URLSearchParams();
  if (teams.length > 0) params.set("teams", teams.join(","));
  if (moves.length > 0) params.set("moves", moves.map((m) => `${m.playerId}-${m.to}`).join(","));
  return params.toString();
}

/**
 * Décode l'état d'un échange depuis l'URL. La provenance de chaque joueur est
 * relue depuis les effectifs (`ownerOf`), donc l'URL reste courte.
 */
export function decodeTrade(
  teamsParam: string | undefined,
  movesParam: string | undefined,
  ownerOf: (playerId: number) => string | undefined
): { teams: string[]; moves: TradeMove[] } {
  const teams = (teamsParam ?? "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 4);

  const moves: TradeMove[] = [];
  for (const token of (movesParam ?? "").split(",")) {
    const [idPart, toPart] = token.split("-");
    const playerId = Number(idPart);
    const to = (toPart ?? "").trim().toUpperCase();
    if (!playerId || !to) continue;
    const from = ownerOf(playerId);
    if (!from || from === to) continue;
    if (!teams.includes(from) || !teams.includes(to)) continue;
    if (moves.some((m) => m.playerId === playerId)) continue;
    moves.push({ playerId, from, to });
  }

  return { teams: [...new Set(teams)], moves };
}
