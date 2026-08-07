/**
 * Moteur de validation des échanges NBA — convention collective 2023.
 *
 * L'objectif est la fidélité : un échange déclaré valide ici doit passer le
 * bureau de la ligue, et un échange refusé doit l'être pour la raison exacte que
 * le moteur affiche. Chaque verdict cite donc sa règle et son calcul.
 *
 * Ce qui est appliqué
 * ───────────────────
 *  1. Concordance salariale à trois paliers, pour une équipe sous les deux
 *     aprons après l'échange (montants indexés sur le plafond) :
 *       · 200 % du sortant + 250 000 $
 *       · sortant + exception élargie (8,53 M$ en 2025-26)
 *       · 125 % du sortant + 250 000 $
 *     La ligue les énonce par tranches de salaire sortant ; les trois courbes se
 *     croisent exactement aux bornes, retenir la plus favorable revient donc au
 *     même sans avoir à recopier des tranches qui bougent chaque été.
 *  2. Absorption dans l'espace sous le plafond, plus 250 000 $.
 *  3. Exception du salaire minimum : un contrat au minimum s'acquiert sans
 *     concordance, quelle que soit la situation de l'équipe.
 *  4. Trade exception (TPE) disponible, saisie par l'utilisateur.
 *  5. Premier apron — dollar pour dollar : une équipe au-dessus après l'échange
 *     ne peut pas reprendre plus de 100 % de ce qu'elle envoie. Corollaire : les
 *     trois paliers sont bornés par la ligne du premier apron.
 *  6. Second apron — interdiction d'agréger deux contrats sortants, interdiction
 *     de verser du cash, pick de premier tour à sept ans gelé.
 *  7. Plafonds durs déclenchés par l'échange : agrégation et versement de
 *     cash verrouillent au second apron ; l'usage de l'exception élargie
 *     verrouille au premier.
 *  8. Cash : plafond annuel versé et reçu, comptés séparément.
 *  9. Picks : propriété, règle des sept ans, règle Stepien, gel au
 *     second apron.
 * 10. Trade kickers (jusqu'à 15 %), base year compensation, poison pill,
 *     contrats two-way, restrictions temporaires et clauses de non-échange.
 * 11. Effectifs : quinze contrats standard au plus, quatorze au moins.
 * 12. Fenêtre d'échange : rien ne se signe après la date limite.
 *
 * Ce qui ne peut pas l'être
 * ─────────────────────────
 * Les données manquent pour trois choses, et le moteur le dit plutôt que de
 * deviner : la propriété réelle des picks (voir `draft-assets.ts`), les
 * clauses individuelles — trade kicker, non-échange, restriction de date —
 * qu'aucune source ne publie, et les trade exceptions en cours. Les
 * premières sont reconstituées, les secondes se déclarent à la main.
 */

import {
  capThresholds,
  tradeAmounts,
  TRADE_CUSHION,
  type CapThresholds,
  type TradeAmounts,
} from "./salary-cap";
import {
  firstRoundersByYear,
  firstTradeableDraftYear,
  frozenPickYear,
  lastTradeableDraftYear,
  pickLabel,
  tradeableDraftYears,
  type DraftPickAsset,
} from "./draft-assets";

/** Limite de joueurs sous contrat standard. */
export const ROSTER_MAX = 15;
/** Minimum de joueurs qu'une équipe doit conserver (treize toléré deux semaines). */
export const ROSTER_MIN = 14;
/** Trade kicker maximal qu'un contrat peut porter. */
export const MAX_TRADE_BONUS_PCT = 15;
/**
 * Nombre d'équipes acceptées dans un même échange. La convention ne fixe pas de
 * limite ; cinq est le record de la ligue (février 2025), et une borne suffit à
 * garder l'interface lisible.
 */
export const MAX_TEAMS = 5;

/* ─────────────────────── Actifs et clauses ─────────────────────── */

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

/** Restrictions temporaires ou personnelles qui bloquent un échange. */
export type RestrictionKey =
  | "dec15"
  | "jan15"
  | "three-months"
  | "six-months"
  | "one-year-bird"
  | "no-trade";

interface RestrictionRule {
  label: string;
  /** Une restriction de date interdit ; une clause de consentement conditionne. */
  level: IssueLevel;
  detail: string;
}

/**
 * Les restrictions individuelles de la convention 2023.
 *
 * Aucune source automatisable ne dit qui les porte : elles se déclarent joueur
 * par joueur dans l'interface. Les libellés disent la règle en entier pour que
 * la déclaration ne soit pas un pari.
 */
export const RESTRICTIONS: Record<RestrictionKey, RestrictionRule> = {
  dec15: {
    label: "Non échangeable avant le 15 décembre",
    level: "error",
    detail:
      "Un free agent qui signe ne peut être échangé pendant trois mois, ou jusqu'au 15 décembre si cette date est plus tardive.",
  },
  jan15: {
    label: "Non échangeable avant le 15 janvier",
    level: "error",
    detail:
      "Un joueur ré-signé par une équipe au-dessus du plafond, via ses droits Bird, avec une hausse d'au moins 20 %, attend le 15 janvier.",
  },
  "three-months": {
    label: "Signé il y a moins de trois mois",
    level: "error",
    detail: "Délai de carence de trois mois après une signature de free agent.",
  },
  "six-months": {
    label: "Prolongation de moins de six mois",
    level: "error",
    detail:
      "Une prolongation qui porte le contrat au-delà de trois saisons avec une hausse supérieure à 5 % gèle l'échange six mois.",
  },
  "one-year-bird": {
    label: "Contrat d'un an avec droits Bird — accord requis",
    level: "warning",
    detail:
      "Le joueur doit consentir ; s'il consent, ses droits Bird ne suivent pas dans sa nouvelle équipe. La convention 2023 permet de renoncer d'avance à cette clause.",
  },
  "no-trade": {
    label: "Clause de non-échange — accord requis",
    level: "warning",
    detail:
      "Réservée aux joueurs comptant huit saisons de ligue dont quatre dans la franchise. L'échange n'existe pas sans la signature du joueur.",
  },
};

/**
 * Clauses d'un contrat qui changent la valeur d'échange d'un joueur.
 *
 * Tout est optionnel et tout part de zéro : le moteur ne suppose rien qu'il ne
 * puisse lire, et une case cochée à tort est visible dans l'interface.
 */
export interface PlayerTradeFlags {
  /** Trade kicker, en pourcentage du salaire restant (0 à 15). */
  tradeBonusPct?: number;
  /** Restriction en vigueur, temporaire ou personnelle. */
  restriction?: RestrictionKey;
  /** Base year compensation : le sortant vaut moins que le contrat. */
  byc?: boolean;
  /** Salaire de la saison précédente, référence du calcul BYC. */
  priorSalary?: number;
  /** Contrat two-way : échangeable, hors concordance et hors quinze. */
  twoWay?: boolean;
  /** Contrat au minimum : acquérable via l'exception du salaire minimum. */
  minimumContract?: boolean;
  /** Poison pill : salaire compté à l'arrivée pour une prolongation rookie. */
  poisonPillIncoming?: number;
}

/** Un joueur placé dans l'échange : d'où il part, où il va. */
export interface TradeMove {
  playerId: number;
  from: string;
  to: string;
}

/** Un pick de draft placé dans l'échange. */
export interface PickMove {
  pickId: string;
  from: string;
  to: string;
}

/** Du cash versé d'une équipe à une autre. */
export interface CashMove {
  from: string;
  to: string;
  amount: number;
}

/* ─────────────────────── Verdicts ─────────────────────── */

export type IssueLevel = "error" | "warning" | "info";

export interface TradeIssue {
  level: IssueLevel;
  message: string;
  /** Règle invoquée, pour regrouper l'affichage. */
  rule?: string;
}

export type MatchRuleKey =
  | "cap-space"
  | "double-200"
  | "expanded-tpe"
  | "standard-125"
  | "dollar-for-dollar"
  | "none";

export type HardCapLevel = "first" | "second" | null;

export interface SalaryMatchPath {
  key: MatchRuleKey;
  /** Salaire entrant maximal par cette voie, en dollars. */
  limit: number;
  label: string;
  /** Apron auquel l'équipe se verrouille pour la saison si elle l'emprunte. */
  hardCap: HardCapLevel;
  /** Renseigné quand la voie est fermée à cette équipe. */
  blockedBy?: string;
}

export interface TeamTradeSummary {
  tricode: string;
  city: string;
  name: string;

  outgoing: TradeRosterPlayer[];
  incoming: TradeRosterPlayer[];
  outgoingPicks: DraftPickAsset[];
  incomingPicks: DraftPickAsset[];
  cashOut: number;
  cashIn: number;

  /** Total sortant retenu pour la concordance (BYC et two-way appliqués). */
  outgoingSalary: number;
  /** Total entrant retenu pour la concordance (primes, poison pill appliqués). */
  incomingSalary: number;
  /** Entrant exempté de concordance : contrats au minimum et two-way. */
  exemptIncoming: number;
  /** Total entrant brut, celui qui pèse sur la masse salariale. */
  incomingPayrollImpact: number;
  /** Total sortant brut, celui qui quitte la masse salariale. */
  outgoingPayrollImpact: number;

  unknownOutgoing: number;
  unknownIncoming: number;

  payrollBefore: number;
  payrollAfter: number;
  capRoomAfter: number;
  taxRoomAfter: number;
  firstApronRoomAfter: number;
  secondApronRoomAfter: number;

  rosterBefore: number;
  rosterAfter: number;

  /** Voie de concordance retenue et les autres, pour montrer le raisonnement. */
  matchRule: SalaryMatchPath;
  paths: SalaryMatchPath[];
  /** Trade exception déclarée disponible, part utilisable comprise. */
  tradeExceptionUsed: number;
  /** Plafond maximal autorisé à l'arrivée, toutes voies cumulées. */
  incomingAllowance: number;
  /** Trade exception créée par l'échange, valable un an. */
  tradeExceptionCreated: number;
  /** Apron auquel l'équipe se retrouve verrouillée, et pourquoi. */
  hardCap: HardCapLevel;
  hardCapReasons: string[];
  /** Joueurs dont l'accord est nécessaire. */
  consentRequired: TradeRosterPlayer[];

  ptsOut: number;
  ptsIn: number;
  rebOut: number;
  rebIn: number;
  astOut: number;
  astIn: number;
  productionOut: number;
  productionIn: number;
  ageBefore: number | null;
  ageAfter: number | null;

  issues: TradeIssue[];
}

export type TradeVerdict = "empty" | "valid" | "conditional" | "incomplete" | "invalid";

export interface TradeEvaluation {
  verdict: TradeVerdict;
  teams: TeamTradeSummary[];
  globalIssues: TradeIssue[];
  thresholds: CapThresholds;
  amounts: TradeAmounts;
  hasUnknownSalaries: boolean;
  /** Vrai si au moins un joueur doit donner son accord. */
  needsConsent: boolean;
}

/**
 * Indice de production composite — un repère unique pour peser les deux côtés
 * d'un échange. Pondération classique des « points créés » : un rebond vaut
 * 1,2 point, une passe 1,5. Indicatif, pas une valeur de marché.
 */
export function productionIndex(p: Pick<TradeRosterPlayer, "pts" | "reb" | "ast">): number {
  return (p.pts ?? 0) + 1.2 * (p.reb ?? 0) + 1.5 * (p.ast ?? 0);
}

/* ─────────────────────── Valeur d'échange d'un joueur ─────────────────────── */

/**
 * Salaire compté au départ.
 *
 * Base year compensation : quand une équipe au-dessus du plafond ré-signe son
 * propre free agent avec une forte hausse, le contrat ne vaut à l'envoi que le
 * plus élevé de l'ancien salaire ou de la moitié du nouveau. L'équipe qui le
 * reçoit, elle, le compte plein — d'où des échanges qui ne concordent que d'un
 * côté.
 */
export function outgoingValue(
  p: TradeRosterPlayer,
  flags: PlayerTradeFlags | undefined
): number {
  if (flags?.twoWay) return 0;
  const salary = p.salary ?? 0;
  if (flags?.byc) return Math.max(flags.priorSalary ?? 0, salary * 0.5);
  return salary;
}

/**
 * Salaire compté à l'arrivée.
 *
 * Un trade kicker s'ajoute au salaire restant et se répartit au prorata sur
 * les années dues : la part de la saison en cours vaut donc le salaire multiplié
 * par le pourcentage de la prime, sans avoir besoin du détail des années. Elle
 * est rabotée si elle porterait le joueur au-delà du salaire maximal.
 *
 * Poison pill : un joueur dont la prolongation rookie n'a pas encore pris effet
 * s'acquiert à la moyenne de sa saison en cours et des années de prolongation,
 * alors qu'il part pour son salaire courant.
 */
export function incomingValue(
  p: TradeRosterPlayer,
  flags: PlayerTradeFlags | undefined,
  amounts: TradeAmounts
): number {
  if (flags?.twoWay) return 0;
  const salary = p.salary ?? 0;
  if (flags?.poisonPillIncoming && flags.poisonPillIncoming > 0) {
    return flags.poisonPillIncoming;
  }
  const pct = Math.min(Math.max(flags?.tradeBonusPct ?? 0, 0), MAX_TRADE_BONUS_PCT);
  if (pct === 0) return salary;
  return Math.min(salary * (1 + pct / 100), Math.max(salary, amounts.maxSalary));
}

/** Vrai si le contrat s'acquiert via l'exception du salaire minimum. */
export function isMinimumContract(
  p: TradeRosterPlayer,
  flags: PlayerTradeFlags | undefined,
  amounts: TradeAmounts
): boolean {
  if (flags?.minimumContract) return true;
  // Détection automatique bornée au minimum d'une recrue : c'est le seul seuil
  // qu'on puisse affirmer sans connaître l'ancienneté du joueur. Un minimum
  // vétéran, plus élevé, se déclare à la main.
  return p.salary != null && p.salary <= amounts.rookieMinimum;
}

/* ─────────────────────── Concordance salariale ─────────────────────── */

interface MatchInput {
  payrollBefore: number;
  outgoingSalary: number;
  /** Nombre de contrats sortants comptés — deux ou plus, c'est une agrégation. */
  outgoingCount: number;
  thresholds: CapThresholds;
  amounts: TradeAmounts;
  /**
   * Agrégation interdite (second apron). L'appelant le sait mieux que nous :
   * la convention regarde la masse salariale *après* l'échange, qui dépend de ce
   * qui entre. Omis, on se rabat sur la masse une fois les partants retirés —
   * suffisant pour afficher un plafond, pas pour rendre un verdict.
   */
  aggregationBanned?: boolean;
}

export interface SalaryMatchResult {
  /** Toutes les voies, ouvertes et fermées, dans l'ordre d'exposition. */
  paths: SalaryMatchPath[];
  /** La plus favorable de celles qui restent ouvertes. */
  best: SalaryMatchPath;
  /**
   * Plafond de la règle des 125 %, calculé même hors de sa tranche : c'est le
   * seuil du plafond dur. Une équipe peut toujours prendre moins que ce que sa
   * tranche autorise, et reste alors libre pour le reste de la saison.
   */
  standardLimit: number;
  /** Bornes des tranches, pour les libellés. */
  tierBreak: number;
  upperBreak: number;
}

/**
 * Les voies légales par lesquelles une équipe peut recevoir du salaire.
 *
 * Le calcul part de la masse salariale une fois les partants retirés : c'est
 * elle qui situe l'équipe par rapport aux lignes. Trois principes structurent
 * l'ensemble.
 *
 * Les trois tranches sont exclusives, pas cumulables. La convention attribue une
 * formule à chaque intervalle de salaire sortant, et il faut la lire ainsi :
 * doubler un contrat de 30 M$ donnerait 60 M$ alors que la ligue n'en accorde
 * que 38,5. Les bornes tombent exactement là où les formules se croisent, ce qui
 * rend le barème continu — vérification : avec l'exception élargie de 7,5 M$ de
 * 2023-24, la borne haute vaut 29 M$, le chiffre publié par la ligue.
 *
 * Aucune tranche ne peut faire franchir le premier apron. Ce n'est pas une règle
 * séparée mais la conséquence du dollar pour dollar : une équipe au-dessus du
 * premier apron après l'échange y est soumise, donc une tranche qui l'y
 * emmènerait s'auto-invalide.
 *
 * Le dollar pour dollar, lui, reste ouvert à toute hauteur de masse salariale.
 */
export function salaryMatch({
  payrollBefore,
  outgoingSalary,
  outgoingCount,
  thresholds,
  amounts,
  aggregationBanned,
}: MatchInput): SalaryMatchResult {
  const payrollAfterOut = payrollBefore - outgoingSalary;
  const roomToApron = Math.max(0, thresholds.firstApron - payrollAfterOut);
  const banned =
    aggregationBanned ?? (outgoingCount > 1 && payrollAfterOut >= thresholds.secondApron);

  const tierBreak = amounts.expandedTpe - TRADE_CUSHION;
  const upperBreak = tierBreak * 4;

  const s = Math.max(0, outgoingSalary);
  const applicable: MatchRuleKey =
    s <= 0 ? "none" : s <= tierBreak ? "double-200" : s <= upperBreak ? "expanded-tpe" : "standard-125";

  /** Plafond d'une tranche : sa formule, bornée par la ligne du premier apron. */
  const capped = (formula: number) => Math.min(formula, roomToApron);
  const standardLimit = s > 0 ? capped(s * 1.25 + TRADE_CUSHION) : 0;

  const tier = (key: MatchRuleKey, formula: number, label: string, range: string): SalaryMatchPath => {
    const path: SalaryMatchPath = {
      key,
      limit: 0,
      label,
      // Les deux tranches supérieures à 125 % constituent l'exception élargie :
      // s'en servir verrouille l'équipe au premier apron.
      hardCap: key === "standard-125" ? null : "first",
    };
    if (key !== applicable) {
      path.blockedBy = s <= 0 ? "Aucun salaire sortant à faire concorder." : `Tranche ${range}.`;
      return path;
    }
    path.limit = capped(formula);
    if (formula > roomToApron) path.blockedBy = "Bornée par la ligne du premier apron.";
    return path;
  };

  const paths: SalaryMatchPath[] = [
    // Absorption sous le plafond : la voie des équipes qui ont de la place.
    {
      key: "cap-space",
      limit: Math.max(0, thresholds.salaryCap + TRADE_CUSHION - payrollAfterOut),
      label: `Absorption dans l'espace sous le plafond, plus ${money(TRADE_CUSHION)}`,
      hardCap: null,
    },
    tier(
      "double-200",
      s * 2 + TRADE_CUSHION,
      `200 % du salaire sortant + ${money(TRADE_CUSHION)}`,
      `réservée à un sortant inférieur à ${money(tierBreak)}`
    ),
    tier(
      "expanded-tpe",
      s + amounts.expandedTpe,
      `Salaire sortant + ${money(amounts.expandedTpe)} (exception élargie)`,
      `réservée à un sortant de ${money(tierBreak)} à ${money(upperBreak)}`
    ),
    tier(
      "standard-125",
      s * 1.25 + TRADE_CUSHION,
      `125 % du salaire sortant + ${money(TRADE_CUSHION)}`,
      `réservée à un sortant supérieur à ${money(upperBreak)}`
    ),
    // Dollar pour dollar : la seule voie ouverte au-dessus du premier apron.
    {
      key: "dollar-for-dollar",
      limit: s,
      label: "Dollar pour dollar (100 % du salaire sortant)",
      hardCap: null,
    },
  ];

  // Au second apron, l'agrégation est interdite : toutes les voies qui reposent
  // sur un total sortant composite tombent avec elle. L'espace sous le plafond
  // survit — mais une équipe au second apron n'en a par construction aucun.
  if (banned && outgoingCount > 1) {
    for (const path of paths) {
      if (path.key === "cap-space") continue;
      path.limit = 0;
      path.blockedBy = "Second apron : agrégation de contrats sortants interdite.";
    }
  }

  const open = paths.reduce((a, b) => (b.limit > a.limit ? b : a), paths[0]);
  const best: SalaryMatchPath =
    open && open.limit > 0
      ? open
      : {
          key: "none",
          limit: 0,
          label: "Aucune marge — l'équipe ne peut rien recevoir",
          hardCap: null,
        };

  return {
    paths,
    best,
    standardLimit: banned && outgoingCount > 1 ? 0 : standardLimit,
    tierBreak,
    upperBreak,
  };
}

/** Le plafond entrant d'une équipe et la règle qui le porte. */
export function salaryMatchLimit(
  payrollBefore: number,
  outgoingSalary: number,
  t: CapThresholds,
  amounts: TradeAmounts = tradeAmounts(t.salaryCap)
): SalaryMatchPath {
  return salaryMatch({
    payrollBefore,
    outgoingSalary,
    outgoingCount: outgoingSalary > 0 ? 1 : 0,
    thresholds: t,
    amounts,
  }).best;
}

/* ─────────────────────── Évaluation ─────────────────────── */

export interface TradeWindow {
  /** Faux entre la date limite et la fin de la saison. */
  open: boolean;
  /** Ce que l'on affiche quand elle est fermée. */
  label: string;
}

interface EvaluateInput {
  season: string;
  /** Équipes engagées dans l'échange (2 à `MAX_TEAMS`). */
  teams: string[];
  moves: TradeMove[];
  /** Effectifs complets des équipes concernées. */
  roster: TradeRosterPlayer[];
  /** Masse salariale de départ par équipe (tricode → dollars). */
  payrollBase: Record<string, number>;
  /** Clauses déclarées, par identifiant de joueur. */
  flags?: Record<number, PlayerTradeFlags>;
  /** Choix de draft placés dans l'échange. */
  pickMoves?: PickMove[];
  /** Stock de choix, avant l'échange. Omis, les choix ne sont pas contrôlés. */
  picks?: DraftPickAsset[];
  /** Cash versé. */
  cash?: CashMove[];
  /**
   * Cash déjà versé et reçu cette saison, par équipe. Le plafond
   * annuel se compte sur la saison, pas sur l'échange.
   */
  cashUsed?: Record<string, { sent?: number; received?: number }>;
  /** Trade exceptions déclarées disponibles, par équipe. */
  tradeExceptions?: Record<string, number>;
  /** Fenêtre d'échange. Omise, on suppose la période ouverte. */
  window?: TradeWindow;
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
  flags = {},
  pickMoves = [],
  picks,
  cash = [],
  cashUsed = {},
  tradeExceptions = {},
  window,
  thresholds: providedThresholds,
}: EvaluateInput): TradeEvaluation {
  const thresholds = providedThresholds ?? capThresholds(season);
  const amounts = tradeAmounts(thresholds.salaryCap);
  const byId = new Map(roster.map((p) => [p.player_id, p]));
  const globalIssues: TradeIssue[] = [];

  /* ── Mouvements retenus ── */

  // Joueur connu, équipes engagées, destination différente de l'origine.
  const validMoves = moves.filter((m) => {
    const p = byId.get(m.playerId);
    return p && m.from !== m.to && teams.includes(m.from) && teams.includes(m.to);
  });

  const pickById = new Map((picks ?? []).map((p) => [p.id, p]));
  const validPicks: { move: PickMove; pick: DraftPickAsset }[] = [];
  for (const m of pickMoves) {
    if (m.from === m.to || !teams.includes(m.from) || !teams.includes(m.to)) continue;
    const pick = pickById.get(m.pickId);
    if (!pick) continue;
    // On ne cède que ce que l'on détient.
    if (pick.owner !== m.from) {
      globalIssues.push({
        level: "error",
        rule: "Propriété des picks",
        message: `${m.from} ne détient pas le ${pickLabel(pick)} de ${pick.originalTeam}.`,
      });
      continue;
    }
    validPicks.push({ move: m, pick });
  }

  const validCash = cash.filter(
    (c) => c.amount > 0 && c.from !== c.to && teams.includes(c.from) && teams.includes(c.to)
  );

  /* ── Fenêtre d'échange ── */

  if (window && !window.open && (validMoves.length > 0 || validPicks.length > 0 || validCash.length > 0)) {
    globalIssues.push({
      level: "error",
      rule: "Fenêtre d'échange",
      message: window.label,
    });
  }

  /* ── Propriété des choix après l'échange, pour Stepien et le gel ── */

  const picksAfter: DraftPickAsset[] = (picks ?? []).map((p) => {
    const move = validPicks.find((v) => v.pick.id === p.id);
    return move ? { ...p, owner: move.move.to } : p;
  });

  // Un tableau vide n'enfreint rien : tant qu'aucun actif n'est posé, on se tait
  // sur la participation et les effectifs. Le bandeau de verdict dit déjà quoi
  // faire, et deux reproches par équipe avant le premier clic ne servent personne.
  const anyAssets = validMoves.length + validPicks.length + validCash.length > 0;

  const draftYears = tradeableDraftYears(season);
  const frozenYear = frozenPickYear(season);
  const firstYear = firstTradeableDraftYear(season);
  const lastYear = lastTradeableDraftYear(season);

  /* ── Résumé par équipe ── */

  const summaries: TeamTradeSummary[] = teams.map((tricode) => {
    const teamRoster = roster.filter((p) => p.team_tricode === tricode);
    const sample = teamRoster[0];
    const issues: TradeIssue[] = [];

    const outgoing = validMoves
      .filter((m) => m.from === tricode)
      .map((m) => byId.get(m.playerId)!)
      .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0));
    const incoming = validMoves
      .filter((m) => m.to === tricode)
      .map((m) => byId.get(m.playerId)!)
      .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0));

    const outgoingPicks = validPicks.filter((v) => v.move.from === tricode).map((v) => v.pick);
    const incomingPicks = validPicks.filter((v) => v.move.to === tricode).map((v) => v.pick);
    const cashOut = validCash.filter((c) => c.from === tricode).reduce((a, c) => a + c.amount, 0);
    const cashIn = validCash.filter((c) => c.to === tricode).reduce((a, c) => a + c.amount, 0);

    /* ── Totaux salariaux ── */

    // Deux comptes distincts, et c'est volontaire : la concordance se calcule sur
    // des valeurs conventionnelles (BYC, primes, poison pill), la masse salariale
    // sur les salaires réels.
    const countedOutgoing = outgoing.filter((p) => !flags[p.player_id]?.twoWay);
    const outgoingSalary = outgoing.reduce((a, p) => a + outgoingValue(p, flags[p.player_id]), 0);
    const outgoingPayrollImpact = outgoing.reduce(
      (a, p) => a + (flags[p.player_id]?.twoWay ? 0 : p.salary ?? 0),
      0
    );

    const exemptIn = incoming.filter((p) => {
      const f = flags[p.player_id];
      return f?.twoWay || isMinimumContract(p, f, amounts);
    });
    const matchedIn = incoming.filter((p) => !exemptIn.includes(p));
    const incomingSalary = matchedIn.reduce((a, p) => a + incomingValue(p, flags[p.player_id], amounts), 0);
    const exemptIncoming = exemptIn.reduce((a, p) => a + incomingValue(p, flags[p.player_id], amounts), 0);
    const incomingPayrollImpact = incoming.reduce(
      (a, p) => a + incomingValue(p, flags[p.player_id], amounts),
      0
    );

    const payrollBefore = payrollBase[tricode] ?? 0;
    const payrollAfter = payrollBefore - outgoingPayrollImpact + incomingPayrollImpact;

    const rosterBefore = teamRoster.length;
    const rosterAfter = rosterBefore - outgoing.length + incoming.length;

    /* ── Voies de concordance ── */

    // L'agrégation se juge sur la masse salariale d'après l'échange : celle-ci
    // est connue, puisque l'utilisateur a désigné les joueurs. Seul le *plafond*
    // entrant serait circulaire, pas le contrôle.
    const aggregating = countedOutgoing.length > 1;
    const overSecondApronAfter = payrollAfter > thresholds.secondApron;
    const aggregationBanned = aggregating && overSecondApronAfter;

    const match = salaryMatch({
      payrollBefore,
      outgoingSalary,
      outgoingCount: countedOutgoing.length,
      thresholds,
      amounts,
      aggregationBanned,
    });
    const paths = match.paths;
    const matchRule = match.best;

    // Trade exception déclarée : elle absorbe du salaire sans concordance,
    // avec la marge de 250 000 $ pour une équipe sous les aprons.
    const declaredTpe = Math.max(0, tradeExceptions[tricode] ?? 0);
    const overFirstApronAfter = payrollAfter > thresholds.firstApron;
    const tradeExceptionUsed =
      declaredTpe > 0 ? declaredTpe + (overFirstApronAfter ? 0 : TRADE_CUSHION) : 0;

    const incomingAllowance = matchRule.limit + tradeExceptionUsed;

    /* ── Contrats inconnus ── */

    // Un salaire manquant est compté pour 0 $, ce qui sous-estime les totaux.
    // Les règles salariales ne sont donc pas opposables : on les rétrograde en
    // avertissement pour ne pas invalider un échange à tort.
    const unknownOutgoing = outgoing.filter((p) => p.salary == null).length;
    const unknownIncoming = incoming.filter((p) => p.salary == null).length;
    const unknownTotal = unknownOutgoing + unknownIncoming;
    const salaryLevel: IssueLevel = unknownTotal > 0 ? "warning" : "error";
    const caveat = unknownTotal > 0 ? " Contrats manquants : vérification indicative." : "";

    if (unknownTotal > 0) {
      issues.push({
        level: "warning",
        rule: "Données",
        message:
          `${unknownTotal} contrat(s) inconnu(s) chez ${tricode} — comptés pour 0 $. ` +
          `La concordance salariale est donc incomplète.`,
      });
    }

    /* ── Participation ── */

    const sends = outgoing.length + outgoingPicks.length + (cashOut > 0 ? 1 : 0);
    const receives = incoming.length + incomingPicks.length + (cashIn > 0 ? 1 : 0);

    if (!anyAssets) {
      // Rien à dire encore.
    } else if (sends === 0 && receives === 0) {
      issues.push({
        level: "error",
        rule: "Participation",
        message: `${tricode} ne participe pas à l'échange — retirez l'équipe ou ajoutez un actif.`,
      });
    } else if (sends === 0 || receives === 0) {
      issues.push({
        level: "warning",
        rule: "Participation",
        message:
          `${tricode} ne fait ${sends === 0 ? "que recevoir" : "qu'envoyer"} — un échange se conclut ` +
          `contre quelque chose, même un 2e tour ou du cash.`,
      });
    }

    /* ── Concordance salariale ── */

    if (incomingSalary > 0) {
      // D'où vient le plafond, dit d'une façon qui se lise même quand la seule
      // voie ouverte est une trade exception.
      const noPath = matchRule.key === "none";
      const exceptionText = `${money(tradeExceptionUsed)} de trade exception`;
      const allowanceSource =
        tradeExceptionUsed > 0
          ? noPath
            ? `${exceptionText}, seule voie disponible`
            : `${matchRule.label}, plus ${exceptionText}`
          : matchRule.label;

      // Tolérance d'un dollar pour absorber les arrondis.
      if (incomingSalary > incomingAllowance + 1) {
        // Une équipe sans aucune voie ouverte mérite qu'on nomme la cause plutôt
        // qu'un plafond à zéro. L'agrégation interdite au second apron, elle, se
        // dit déjà par sa propre règle : inutile de la répéter ici.
        const noRoute = incomingAllowance <= 0;
        issues.push({
          level: salaryLevel,
          rule: "Concordance salariale",
          message: noRoute
            ? aggregationBanned
              ? `${tricode} ne peut donc rien recevoir : ${money(incomingSalary)} à faire concorder ` +
                `pour aucune voie ouverte.${caveat}`
              : `${tricode} n'a aucune voie légale pour recevoir du salaire — ni espace sous le ` +
                `plafond, ni salaire sortant à faire concorder — et en reçoit ${money(incomingSalary)}.${caveat}`
            : `${tricode} reçoit ${money(incomingSalary)} à faire concorder pour ${money(outgoingSalary)} envoyés. ` +
              `Maximum autorisé : ${money(incomingAllowance)} (${allowanceSource}). ` +
              `Dépassement de ${money(incomingSalary - incomingAllowance)}.${caveat}`,
        });
      }
    }

    /* ── Aprons et plafonds durs ── */

    // Ce qui verrouille l'équipe, et à quelle ligne. Le premier apron étant plus
    // bas, c'est lui qui l'emporte quand les deux verrous se cumulent.
    const locksAtFirst: string[] = [];
    const locksAtSecond: string[] = [];

    if (aggregating && incomingSalary > 0) {
      if (aggregationBanned) {
        issues.push({
          level: salaryLevel,
          rule: "Second apron",
          message:
            `${tricode} est au-dessus du second apron après l'échange : impossible d'agréger ` +
            `${countedOutgoing.length} contrats sortants pour absorber un salaire entrant.${caveat}`,
        });
      } else {
        locksAtSecond.push(`agrégation de ${countedOutgoing.length} contrats sortants`);
      }
    }

    if (cashOut > 0) {
      if (overSecondApronAfter) {
        issues.push({
          level: salaryLevel,
          rule: "Second apron",
          message: `${tricode} est au-dessus du second apron : elle ne peut pas verser de cash.${caveat}`,
        });
      } else {
        locksAtSecond.push("versement de cash");
      }
    }

    // L'exception élargie n'est « employée » que si l'entrant dépasse toutes les
    // voies qui n'en relèvent pas : espace sous le plafond, 125 %, dollar pour
    // dollar. Reprendre 100 % de ce qu'on envoie ne verrouille jamais personne —
    // c'est même la seule voie d'une équipe déjà au-dessus du premier apron.
    const limitOf = (key: MatchRuleKey) => paths.find((p) => p.key === key)?.limit ?? 0;
    const withoutExpanded =
      Math.max(match.standardLimit, limitOf("cap-space"), limitOf("dollar-for-dollar")) +
      tradeExceptionUsed;
    if (incomingSalary > withoutExpanded + 1 && incomingSalary <= incomingAllowance + 1) {
      locksAtFirst.push("usage de l'exception élargie au-delà de 125 %");
    }

    const hardCap: HardCapLevel =
      locksAtFirst.length > 0 ? "first" : locksAtSecond.length > 0 ? "second" : null;
    const hardCapReasons = [...locksAtFirst, ...locksAtSecond];

    if (hardCap !== null) {
      const line = hardCap === "first" ? thresholds.firstApron : thresholds.secondApron;
      const lineName = hardCap === "first" ? "premier" : "second";
      const reasons = hardCapReasons.join(", ");
      issues.push(
        payrollAfter > line
          ? {
              level: salaryLevel,
              rule: "Hard cap",
              message:
                `${tricode} se verrouille au ${lineName} apron (${reasons}) mais le dépasserait déjà ` +
                `de ${money(payrollAfter - line)} après l'échange.${caveat}`,
            }
          : {
              level: "info",
              rule: "Hard cap",
              message:
                `${tricode} se verrouille au ${lineName} apron pour le reste de la saison (${reasons}) : ` +
                `sa masse salariale ne pourra plus dépasser ${money(line)} d'ici juin.`,
            }
      );
    }

    /* ── Cash ── */

    if (cashOut > 0 || cashIn > 0) {
      const used = cashUsed[tricode] ?? {};
      const sentTotal = (used.sent ?? 0) + cashOut;
      const receivedTotal = (used.received ?? 0) + cashIn;
      if (sentTotal > amounts.cashLimit) {
        issues.push({
          level: "error",
          rule: "Cash",
          message:
            `${tricode} verserait ${money(sentTotal)} sur la saison, au-delà du plafond annuel de ` +
            `${money(amounts.cashLimit)}.`,
        });
      }
      if (receivedTotal > amounts.cashLimit) {
        issues.push({
          level: "error",
          rule: "Cash",
          message:
            `${tricode} recevrait ${money(receivedTotal)} sur la saison, au-delà du plafond annuel de ` +
            `${money(amounts.cashLimit)}.`,
        });
      }
    }

    /* ── Choix de draft ── */

    if (picks && outgoingPicks.length > 0) {
      for (const pick of outgoingPicks) {
        if (pick.year < firstYear || pick.year > lastYear) {
          issues.push({
            level: "error",
            rule: "Règle des sept ans",
            message:
              `${tricode} ne peut pas échanger un pick de ${pick.year} : la fenêtre s'arrête à ` +
              `${lastYear}, sept drafts devant nous.`,
          });
        }
        if (
          pick.round === 1 &&
          pick.year === frozenYear &&
          pick.originalTeam === tricode &&
          payrollBefore > thresholds.secondApron
        ) {
          issues.push({
            level: "error",
            rule: "Second apron",
            message:
              `Le premier tour ${frozenYear} de ${tricode} est gelé : une équipe au-dessus du second ` +
              `apron perd le droit d'échanger son pick situé sept ans plus loin.`,
          });
        }
      }
    }

    if (picks) {
      // Règle Stepien : jamais deux drafts consécutives sans premier tour. Ce
      // n'est pas « son » choix qui compte mais le fait d'en détenir un — une
      // équipe régularise en acquérant celui d'une autre.
      const held = firstRoundersByYear(picksAfter, tricode);
      for (let i = 0; i < draftYears.length - 1; i++) {
        const a = draftYears[i];
        const b = draftYears[i + 1];
        if (!held.has(a) && !held.has(b)) {
          issues.push({
            level: "error",
            rule: "Règle Stepien",
            message:
              `${tricode} se retrouverait sans premier tour en ${a} et ${b}. La règle Stepien interdit ` +
              `deux drafts consécutives sans pick de premier tour.`,
          });
          break;
        }
      }
    }

    /* ── Clauses individuelles ── */

    const consentRequired: TradeRosterPlayer[] = [];
    for (const p of outgoing) {
      const key = flags[p.player_id]?.restriction;
      if (!key) continue;
      const rule = RESTRICTIONS[key];
      if (rule.level === "warning") consentRequired.push(p);
      issues.push({
        level: rule.level,
        rule: "Restriction individuelle",
        message: `${p.first_name} ${p.last_name} (${tricode}) : ${rule.label.toLowerCase()}. ${rule.detail}`,
      });
    }

    for (const p of outgoing) {
      const f = flags[p.player_id];
      if (f?.byc) {
        issues.push({
          level: "info",
          rule: "Base year compensation",
          message:
            `${p.first_name} ${p.last_name} part pour ${money(outgoingValue(p, f))} au titre du BYC, ` +
            `alors que ${money(p.salary ?? 0)} quittent la masse salariale — et que l'équipe qui le ` +
            `reçoit le compte plein.`,
        });
      }
    }

    for (const p of incoming) {
      const f = flags[p.player_id];
      const pct = Math.min(Math.max(f?.tradeBonusPct ?? 0, 0), MAX_TRADE_BONUS_PCT);
      if (pct > 0) {
        const value = incomingValue(p, f, amounts);
        issues.push({
          level: "info",
          rule: "Trade kicker",
          message:
            `${p.first_name} ${p.last_name} porte un trade kicker de ${pct} % : ${tricode} le compte à ` +
            `${money(value)} au lieu de ${money(p.salary ?? 0)}.`,
        });
      }
    }

    /* ── Effectif ── */

    const twoWayIn = incoming.filter((p) => flags[p.player_id]?.twoWay).length;
    const twoWayOut = outgoing.filter((p) => flags[p.player_id]?.twoWay).length;
    const standardAfter = rosterAfter - twoWayIn + twoWayOut;

    // On ne signale un effectif hors limite que si l'échange en est la cause.
    // La table des effectifs recense tous les joueurs passés par la franchise sur
    // la saison : presque toutes dépassent donc quinze noms, et le dire à chaque
    // fois noierait le verdict sous un reproche qui ne vient pas de l'échange.
    const netBodies = standardAfter - rosterBefore;

    if (standardAfter > ROSTER_MAX && netBodies > 0) {
      issues.push({
        level: "warning",
        rule: "Effectif",
        message:
          `${tricode} monterait à ${standardAfter} contrats standard listés (limite de ${ROSTER_MAX}) — ` +
          `la franchise devrait libérer ${standardAfter - ROSTER_MAX} place(s).`,
      });
    } else if (standardAfter < ROSTER_MIN && netBodies < 0) {
      issues.push({
        level: "warning",
        rule: "Effectif",
        message:
          `${tricode} descendrait à ${standardAfter} contrats standard listés (minimum de ${ROSTER_MIN}, ` +
          `toléré deux semaines) — la franchise devrait signer un joueur.`,
      });
    }

    /* ── Exception créée ── */

    // Envoyer plus qu'on ne reçoit crée une trade exception, valable un an.
    // Elle n'existe que pour une équipe au-dessus du plafond, et l'agrégation la
    // supprime : les contrats agrégés n'en génèrent aucune.
    const tradeExceptionCreated =
      payrollAfter > thresholds.salaryCap && !aggregating && outgoingSalary > incomingSalary
        ? outgoingSalary - incomingSalary
        : 0;

    if (tradeExceptionCreated > 0) {
      issues.push({
        level: "info",
        rule: "Trade exception",
        message:
          `${tricode} génère une trade exception de ${money(tradeExceptionCreated)}, utilisable ` +
          `pendant un an.`,
      });
    }

    /* ── Âge moyen ── */

    const outIds = new Set(outgoing.map((p) => p.player_id));
    const agesBefore = teamRoster.map((p) => p.age).filter((a): a is number => a != null);
    const agesAfter = [...teamRoster.filter((p) => !outIds.has(p.player_id)), ...incoming]
      .map((p) => p.age)
      .filter((a): a is number => a != null);

    return {
      tricode,
      city: sample?.team_city ?? tricode,
      name: sample?.team_name ?? "",
      outgoing,
      incoming,
      outgoingPicks,
      incomingPicks,
      cashOut,
      cashIn,
      outgoingSalary,
      incomingSalary,
      exemptIncoming,
      incomingPayrollImpact,
      outgoingPayrollImpact,
      unknownOutgoing,
      unknownIncoming,
      payrollBefore,
      payrollAfter,
      capRoomAfter: thresholds.salaryCap - payrollAfter,
      taxRoomAfter: thresholds.luxuryTax - payrollAfter,
      firstApronRoomAfter: thresholds.firstApron - payrollAfter,
      secondApronRoomAfter: thresholds.secondApron - payrollAfter,
      rosterBefore,
      rosterAfter: standardAfter,
      matchRule,
      paths,
      tradeExceptionUsed,
      incomingAllowance,
      tradeExceptionCreated,
      hardCap,
      hardCapReasons,
      consentRequired,
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
    globalIssues.push({
      level: "error",
      rule: "Participation",
      message: "Sélectionnez au moins deux équipes.",
    });
  }

  const hasUnknownSalaries = summaries.some((s) => s.unknownOutgoing + s.unknownIncoming > 0);
  const needsConsent = summaries.some((s) => s.consentRequired.length > 0);
  const hasErrors =
    globalIssues.some((i) => i.level === "error") ||
    summaries.some((s) => s.issues.some((i) => i.level === "error"));

  const assetCount = validMoves.length + validPicks.length + validCash.length;

  let verdict: TradeVerdict;
  if (assetCount === 0) verdict = "empty";
  else if (hasErrors) verdict = "invalid";
  else if (hasUnknownSalaries) verdict = "incomplete";
  else if (needsConsent) verdict = "conditional";
  else verdict = "valid";

  return {
    verdict,
    teams: summaries,
    globalIssues,
    thresholds,
    amounts,
    hasUnknownSalaries,
    needsConsent,
  };
}

/** Formatage court réutilisé dans les messages du moteur. */
function money(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2).replace(".", ",")} M$`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)} k$`;
  return `${sign}${abs} $`;
}

/* ─── Encodage de l'échange dans l'URL (partage) ─── */

/** Codes courts des restrictions, pour tenir dans une URL lisible. */
const RESTRICTION_CODES: Record<RestrictionKey, string> = {
  dec15: "d15",
  jan15: "j15",
  "three-months": "m3",
  "six-months": "m6",
  "one-year-bird": "b1",
  "no-trade": "ntc",
};

const CODE_TO_RESTRICTION = Object.fromEntries(
  Object.entries(RESTRICTION_CODES).map(([key, code]) => [code, key as RestrictionKey])
) as Record<string, RestrictionKey>;

export interface TradeState {
  teams: string[];
  moves: TradeMove[];
  pickMoves: PickMove[];
  cash: CashMove[];
  flags: Record<number, PlayerTradeFlags>;
  tradeExceptions: Record<string, number>;
}

/**
 * `?teams=BOS,LAL&moves=201143-LAL&picks=BOS.2029.1.LAL&cash=BOS.LAL.2000000`
 *
 * Les clauses tiennent dans `flags`, une liste de codes par joueur :
 * `flags=201143.k15-ntc` — prime de 15 % et clause de non-échange.
 */
export function encodeTrade(
  teams: string[],
  moves: TradeMove[],
  extra: {
    pickMoves?: PickMove[];
    cash?: CashMove[];
    flags?: Record<number, PlayerTradeFlags>;
    tradeExceptions?: Record<string, number>;
  } = {}
): string {
  const params = new URLSearchParams();
  if (teams.length > 0) params.set("teams", teams.join(","));
  if (moves.length > 0) params.set("moves", moves.map((m) => `${m.playerId}-${m.to}`).join(","));

  const pickMoves = extra.pickMoves ?? [];
  if (pickMoves.length > 0) {
    params.set("picks", pickMoves.map((m) => `${m.pickId.replace(/-/g, ".")}.${m.to}`).join(","));
  }

  const cash = (extra.cash ?? []).filter((c) => c.amount > 0);
  if (cash.length > 0) {
    params.set("cash", cash.map((c) => `${c.from}.${c.to}.${Math.round(c.amount)}`).join(","));
  }

  const flagTokens: string[] = [];
  for (const [id, f] of Object.entries(extra.flags ?? {})) {
    const codes: string[] = [];
    if (f.tradeBonusPct) codes.push(`k${Math.round(f.tradeBonusPct)}`);
    if (f.restriction) codes.push(RESTRICTION_CODES[f.restriction]);
    if (f.byc) codes.push("byc");
    if (f.priorSalary) codes.push(`p${Math.round(f.priorSalary)}`);
    if (f.twoWay) codes.push("tw");
    if (f.minimumContract) codes.push("min");
    if (f.poisonPillIncoming) codes.push(`pp${Math.round(f.poisonPillIncoming)}`);
    if (codes.length > 0) flagTokens.push(`${id}.${codes.join("-")}`);
  }
  if (flagTokens.length > 0) params.set("flags", flagTokens.join(","));

  const tpe = Object.entries(extra.tradeExceptions ?? {}).filter(([, v]) => v > 0);
  if (tpe.length > 0) {
    params.set("tpe", tpe.map(([team, v]) => `${team}.${Math.round(v)}`).join(","));
  }

  return params.toString();
}

/**
 * Décode l'état d'un échange depuis l'URL. La provenance de chaque joueur est
 * relue depuis les effectifs (`ownerOf`), et celle d'un choix depuis le stock
 * (`pickOwnerOf`), donc l'URL reste courte.
 */
export function decodeTrade(
  params: {
    teams?: string;
    moves?: string;
    picks?: string;
    cash?: string;
    flags?: string;
    tpe?: string;
  },
  ownerOf: (playerId: number) => string | undefined,
  pickOwnerOf?: (pickId: string) => string | undefined
): TradeState {
  const teams = (params.teams ?? "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_TEAMS);
  const unique = [...new Set(teams)];

  const moves: TradeMove[] = [];
  for (const token of (params.moves ?? "").split(",")) {
    const [idPart, toPart] = token.split("-");
    const playerId = Number(idPart);
    const to = (toPart ?? "").trim().toUpperCase();
    if (!playerId || !to) continue;
    const from = ownerOf(playerId);
    if (!from || from === to) continue;
    if (!unique.includes(from) || !unique.includes(to)) continue;
    if (moves.some((m) => m.playerId === playerId)) continue;
    moves.push({ playerId, from, to });
  }

  const pickMoves: PickMove[] = [];
  for (const token of (params.picks ?? "").split(",")) {
    const parts = token.split(".");
    if (parts.length !== 4) continue;
    const [origin, year, round, toRaw] = parts;
    const pickId = `${origin.toUpperCase()}-${year}-${round}`;
    const to = toRaw.trim().toUpperCase();
    const from = pickOwnerOf?.(pickId) ?? origin.toUpperCase();
    if (!to || from === to) continue;
    if (!unique.includes(from) || !unique.includes(to)) continue;
    if (pickMoves.some((m) => m.pickId === pickId)) continue;
    pickMoves.push({ pickId, from, to });
  }

  const cash: CashMove[] = [];
  for (const token of (params.cash ?? "").split(",")) {
    const [fromRaw, toRaw, amountRaw] = token.split(".");
    const from = (fromRaw ?? "").trim().toUpperCase();
    const to = (toRaw ?? "").trim().toUpperCase();
    const amount = Number(amountRaw);
    if (!from || !to || from === to || !Number.isFinite(amount) || amount <= 0) continue;
    if (!unique.includes(from) || !unique.includes(to)) continue;
    cash.push({ from, to, amount });
  }

  const flags: Record<number, PlayerTradeFlags> = {};
  for (const token of (params.flags ?? "").split(",")) {
    const [idPart, codePart] = token.split(".");
    const playerId = Number(idPart);
    if (!playerId || !codePart) continue;
    const f: PlayerTradeFlags = {};
    for (const code of codePart.split("-")) {
      if (CODE_TO_RESTRICTION[code]) f.restriction = CODE_TO_RESTRICTION[code];
      else if (code === "byc") f.byc = true;
      else if (code === "tw") f.twoWay = true;
      else if (code === "min") f.minimumContract = true;
      else if (/^k\d+$/.test(code)) f.tradeBonusPct = Math.min(Number(code.slice(1)), MAX_TRADE_BONUS_PCT);
      else if (/^p\d+$/.test(code)) f.priorSalary = Number(code.slice(1));
      else if (/^pp\d+$/.test(code)) f.poisonPillIncoming = Number(code.slice(2));
    }
    if (Object.keys(f).length > 0) flags[playerId] = f;
  }

  const tradeExceptions: Record<string, number> = {};
  for (const token of (params.tpe ?? "").split(",")) {
    const [teamRaw, amountRaw] = token.split(".");
    const team = (teamRaw ?? "").trim().toUpperCase();
    const amount = Number(amountRaw);
    if (!team || !unique.includes(team) || !Number.isFinite(amount) || amount <= 0) continue;
    tradeExceptions[team] = amount;
  }

  return { teams: unique, moves, pickMoves, cash, flags, tradeExceptions };
}
