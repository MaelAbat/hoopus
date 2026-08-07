/**
 * Vérification du moteur d'échange contre la convention collective 2023.
 *
 * Les montants attendus ne sont pas recalculés depuis le code mais recopiés des
 * chiffres publiés par la ligue : c'est tout l'intérêt du test. L'exception
 * élargie 2025-26 vaut 8 527 000 $, le plafond de liquidités 7 964 000 $, et la
 * borne haute des tranches tombe sur 29 M$ en 2023-24.
 */

import {
  decodeTrade,
  encodeTrade,
  evaluateTrade,
  isMinimumContract,
  outgoingValue,
  salaryMatch,
  salaryMatchLimit,
  type PlayerTradeFlags,
  type TradeRosterPlayer,
} from "../src/lib/trade-rules";
import { capThresholds, tradeAmounts } from "../src/lib/salary-cap";
import { buildPickInventory, type DraftPickAsset } from "../src/lib/draft-assets";

const SEASON = "2025-26";
const T = capThresholds(SEASON);
const A = tradeAmounts(T.salaryCap);
const M = (n: number) => (n / 1e6).toFixed(2) + "M";

function player(
  id: number,
  name: string,
  team: string,
  salary: number | null,
  pts = 10
): TradeRosterPlayer {
  return {
    player_id: id,
    first_name: "P",
    last_name: name,
    team_tricode: team,
    team_city: team,
    team_name: "Team",
    position: "F",
    age: 27,
    salary,
    pts,
    reb: 5,
    ast: 3,
  };
}

let pass = 0,
  fail = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`}`
  );
  ok ? pass++ : fail++;
}

/** Les messages d'une équipe, à un niveau donné. */
const messages = (
  e: ReturnType<typeof evaluateTrade>,
  team: number,
  level?: "error" | "warning" | "info"
) =>
  e.teams[team].issues
    .filter((i) => !level || i.level === level)
    .map((i) => i.message)
    .join(" | ");

const hasError = (e: ReturnType<typeof evaluateTrade>, needle: string) =>
  [...e.globalIssues, ...e.teams.flatMap((t) => t.issues)].some(
    (i) => i.level === "error" && i.message.includes(needle)
  );

console.log("Seuils:", {
  cap: M(T.salaryCap),
  tax: M(T.luxuryTax),
  a1: M(T.firstApron),
  a2: M(T.secondApron),
});

/* ════════════════ Montants indexés sur le plafond ════════════════ */
console.log("\n--- montants indexés ---");

check("exception élargie 2025-26 (publiée : 8 527 000 $)", A.expandedTpe, 8_527_000);
check("plafond de liquidités 2025-26 (publié : 7 964 000 $)", A.cashLimit, 7_964_000);
check(
  "plafond de liquidités 2026-27 (publié : ~8,5 M$)",
  tradeAmounts(164_961_000).cashLimit,
  8_495_000
);
check(
  "exception élargie 2023-24 (convention : 7,5 M$)",
  Math.round(tradeAmounts(136_021_000).expandedTpe / 100_000) * 100_000,
  7_500_000
);
check(
  "borne haute des tranches en 2023-24 (publiée : 29 M$)",
  (tradeAmounts(136_021_000).expandedTpe - 250_000) * 4,
  29_000_000
);
check("seuils 2026-27 déduits du plafond publié", capThresholds("2026-27"), {
  salaryCap: 164_961_000,
  luxuryTax: 200_428_000,
  firstApron: 209_015_000,
  secondApron: 221_686_000,
});

/* ════════════════ Concordance salariale ════════════════ */
console.log("\n--- tranches de concordance ---");

// Tranche basse : un petit contrat se double.
{
  const r = salaryMatchLimit(170_000_000, 5_000_000, T);
  check("sortant 5 M$ -> 200 % + 250 k$", [r.key, Math.round(r.limit)], ["double-200", 10_250_000]);
}
// Tranche intermédiaire : l'exception élargie. Doubler donnerait 40,25 M$ —
// c'est précisément l'erreur que la lecture par tranches évite.
{
  const r = salaryMatchLimit(170_000_000, 20_000_000, T);
  check(
    "sortant 20 M$ -> sortant + exception élargie",
    [r.key, Math.round(r.limit)],
    ["expanded-tpe", 28_527_000]
  );
}
// Tranche haute : la règle historique.
{
  const r = salaryMatchLimit(170_000_000, 40_000_000, T);
  check(
    "sortant 40 M$ -> 125 % + 250 k$",
    [r.key, Math.round(r.limit)],
    ["standard-125", 50_250_000]
  );
}
// Continuité du barème aux deux bornes.
{
  const brk = A.expandedTpe - 250_000;
  const low = salaryMatch({
    payrollBefore: 170_000_000,
    outgoingSalary: brk,
    outgoingCount: 1,
    thresholds: T,
    amounts: A,
  });
  check("borne basse : 200 % et exception élargie se rejoignent", brk * 2 + 250_000, brk + A.expandedTpe);
  check("  ... et la borne vaut bien 8,28 M$", brk, 8_277_000);
  check("  tranche retenue à la borne", low.best.key, "double-200");
  const top = brk * 4;
  check("borne haute : exception élargie et 125 % se rejoignent", top + A.expandedTpe, top * 1.25 + 250_000);
}
// Au-dessus du premier apron : dollar pour dollar, les tranches sont bornées.
{
  const r = salaryMatchLimit(200_000_000, 20_000_000, T);
  check(
    "au-dessus du 1er apron -> 100 %",
    [r.key, Math.round(r.limit)],
    ["dollar-for-dollar", 20_000_000]
  );
}
// Une tranche ne doit jamais faire franchir le premier apron.
{
  const payroll = 190_000_000,
    out = 20_000_000;
  const r = salaryMatchLimit(payroll, out, T);
  check("tranche bornée au 1er apron", payroll - out + r.limit <= T.firstApron, true);
  check("  ... et au moins 100 % du sortant", r.limit >= out, true);
}
// Rien envoyé, aucune marge : rien ne peut entrer (pas de 250 k$ fantôme).
{
  const r = salaryMatchLimit(200_000_000, 0, T);
  check("apron, rien envoyé -> limite 0", [r.key, r.limit], ["none", 0]);
}
// Sous le plafond : absorption dans l'espace, plus la marge.
{
  const r = salaryMatchLimit(100_000_000, 0, T);
  check(
    "sous le cap, rien envoyé -> espace + 250 k$",
    [r.key, Math.round(r.limit)],
    ["cap-space", T.salaryCap + 250_000 - 100_000_000]
  );
}

/* ════════════════ Échanges de joueurs ════════════════ */
console.log("\n--- évaluation ---");

const base = (over: Record<string, number>) => ({ season: SEASON, payrollBase: over });

// 1. Échange équilibré entre deux équipes au-dessus du plafond.
{
  const roster = [
    player(1, "AA", "BOS", 30_000_000),
    player(2, "BB", "BOS", 5_000_000),
    player(3, "CC", "LAL", 29_000_000),
    player(4, "DD", "LAL", 5_000_000),
  ];
  const e = evaluateTrade({
    ...base({ BOS: 170_000_000, LAL: 170_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "BOS" },
    ],
    roster,
  });
  check("échange équilibré (over cap) -> valide", e.verdict, "valid");
  check("  masse BOS après", e.teams[0].payrollAfter, 169_000_000);
}

// 2. Équipe au-dessus de l'apron qui reçoit plus qu'elle n'envoie.
{
  const roster = [player(1, "AA", "BOS", 10_000_000), player(3, "CC", "LAL", 30_000_000)];
  const e = evaluateTrade({
    ...base({ BOS: 205_000_000, LAL: 150_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "BOS" },
    ],
    roster,
  });
  check("apron reçoit plus qu'il n'envoie -> invalide", e.verdict, "invalid");
  check("  concordance en cause", hasError(e, "Maximum autorisé"), true);
}

// 3. Second apron : agrégation de deux contrats interdite.
{
  const roster = [
    player(1, "AA", "BOS", 15_000_000),
    player(2, "BB", "BOS", 15_000_000),
    player(3, "CC", "LAL", 30_000_000),
  ];
  const e = evaluateTrade({
    ...base({ BOS: 215_000_000, LAL: 150_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" },
      { playerId: 2, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "BOS" },
    ],
    roster,
  });
  check("second apron agrège 2 contrats -> invalide", e.verdict, "invalid");
  check("  message d'agrégation", hasError(e, "agréger"), true);
}

// 4. Entre les aprons : l'agrégation est permise mais verrouille au second apron.
{
  const roster = [
    player(1, "AA", "BOS", 10_000_000),
    player(2, "BB", "BOS", 10_000_000),
    player(3, "CC", "LAL", 20_000_000),
  ];
  const e = evaluateTrade({
    ...base({ BOS: 200_000_000, LAL: 150_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" },
      { playerId: 2, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "BOS" },
    ],
    roster,
  });
  check("agrégation entre les aprons -> valide", e.verdict, "valid");
  check("  verrou au second apron", e.teams[0].hardCap, "second");
  check("  motif indiqué", messages(e, 0, "info").includes("second apron"), true);
}

// 5. Absorption dans l'espace sous le plafond, sans rien renvoyer.
{
  const roster = [player(1, "AA", "BOS", 30_000_000), player(9, "ZZ", "UTA", 2_000_000)];
  const e = evaluateTrade({
    ...base({ BOS: 190_000_000, UTA: 110_000_000 }),
    teams: ["BOS", "UTA"],
    moves: [{ playerId: 1, from: "BOS", to: "UTA" }],
    roster,
  });
  check("absorption dans l'espace cap -> valide", e.verdict, "valid");
  check("  règle retenue", e.teams[1].matchRule.key, "cap-space");
  check("  BOS génère une exception d'échange", e.teams[0].tradeExceptionCreated, 30_000_000);
}

// 6. Contrat inconnu : verdict incomplet, pas invalide.
{
  const roster = [player(1, "AA", "BOS", null), player(3, "CC", "LAL", 5_000_000)];
  const e = evaluateTrade({
    ...base({ BOS: 150_000_000, LAL: 150_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "BOS" },
    ],
    roster,
  });
  check("contrat inconnu -> incomplet", e.verdict, "incomplete");
  check("  aucune erreur", e.teams.every((t) => t.issues.every((i) => i.level !== "error")), true);
}

// 7. Équipe présente mais qui ne participe pas.
{
  const roster = [
    player(1, "AA", "BOS", 5_000_000),
    player(3, "CC", "LAL", 5_000_000),
    player(5, "EE", "NYK", 5_000_000),
  ];
  const e = evaluateTrade({
    ...base({ BOS: 150_000_000, LAL: 150_000_000, NYK: 150_000_000 }),
    teams: ["BOS", "LAL", "NYK"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "BOS" },
    ],
    roster,
  });
  check("équipe inactive -> invalide", e.verdict, "invalid");
  check("  message cible NYK", messages(e, 2).includes("ne participe pas"), true);
}

// 8. Échange à cinq équipes — le record de la ligue.
{
  const tricodes = ["BOS", "LAL", "NYK", "MIA", "PHX"];
  const roster = tricodes.map((t, i) => player(10 + i, `P${i}`, t, 20_000_000));
  const e = evaluateTrade({
    ...base(Object.fromEntries(tricodes.map((t) => [t, 170_000_000]))),
    teams: tricodes,
    moves: tricodes.map((t, i) => ({
      playerId: 10 + i,
      from: t,
      to: tricodes[(i + 1) % tricodes.length],
    })),
    roster,
  });
  check("échange à 5 équipes en ronde -> valide", e.verdict, "valid");
}

// 9. Aucun actif.
{
  const e = evaluateTrade({ ...base({}), teams: ["BOS", "LAL"], moves: [], roster: [] });
  check("aucun actif -> vide", e.verdict, "empty");
}

// 10. Une équipe qui ne fait que recevoir, et qui a la place : avertissement,
// pas erreur. L'échange est légal, il est seulement bancal.
{
  const roster = [player(1, "AA", "BOS", 5_000_000), player(3, "CC", "LAL", 5_000_000)];
  const e = evaluateTrade({
    ...base({ BOS: 150_000_000, LAL: 140_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [{ playerId: 1, from: "BOS", to: "LAL" }],
    roster,
  });
  check("cadeau unilatéral -> valide avec réserve", e.verdict, "valid");
  check("  BOS ne fait qu'envoyer", messages(e, 0, "warning").includes("ne fait qu'envoyer"), true);
}

// 11. La même absorption sans la place : la concordance s'y oppose.
{
  const roster = [player(1, "AA", "BOS", 5_000_000), player(3, "CC", "LAL", 5_000_000)];
  const e = evaluateTrade({
    ...base({ BOS: 150_000_000, LAL: 152_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [{ playerId: 1, from: "BOS", to: "LAL" }],
    roster,
  });
  check("absorption au-delà de l'espace cap -> invalide", e.verdict, "invalid");
  check("  espace cap invoqué", messages(e, 1, "error").includes("espace sous le plafond"), true);
}

/* ════════════════ Effectifs ════════════════ */
console.log("\n--- effectifs ---");

/** Une équipe de `n` joueurs, plus un partant identifiable. */
const squad = (team: string, n: number, firstId: number) =>
  Array.from({ length: n }, (_, i) => player(firstId + i, `${team}${i}`, team, 5_000_000));

// La table des effectifs recense tous les joueurs de la saison : presque toutes
// les équipes dépassent quinze noms. Un échange à somme nulle ne doit rien dire.
{
  const roster = [...squad("BOS", 19, 100), ...squad("LAL", 19, 200)];
  const e = evaluateTrade({
    ...base({ BOS: 170_000_000, LAL: 170_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [
      { playerId: 100, from: "BOS", to: "LAL" },
      { playerId: 200, from: "LAL", to: "BOS" },
    ],
    roster,
  });
  check("effectif déjà hors limite, échange 1 contre 1 -> silence", e.verdict, "valid");
  check("  aucune remarque d'effectif", messages(e, 0).includes("contrats standard"), false);
}
// En revanche, un échange qui ajoute un corps est bien signalé.
{
  const roster = [...squad("BOS", 19, 100), ...squad("LAL", 19, 200)];
  const e = evaluateTrade({
    ...base({ BOS: 170_000_000, LAL: 170_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [
      { playerId: 100, from: "BOS", to: "LAL" },
      { playerId: 200, from: "LAL", to: "BOS" },
      { playerId: 201, from: "LAL", to: "BOS" },
    ],
    roster,
  });
  check("échange qui gonfle l'effectif -> signalé", messages(e, 0).includes("monterait à 20"), true);
  check("  et l'équipe qui dégraisse ne l'est pas", messages(e, 1).includes("contrats standard"), false);
}
// Descendre sous le minimum, en revanche, se dit.
{
  const roster = [...squad("BOS", 14, 100), ...squad("LAL", 18, 200)];
  const e = evaluateTrade({
    ...base({ BOS: 170_000_000, LAL: 140_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [{ playerId: 100, from: "BOS", to: "LAL" }],
    roster,
  });
  check("descendre sous quatorze -> signalé", messages(e, 0).includes("descendrait à 13"), true);
}

/* ════════════════ Clauses de contrat ════════════════ */
console.log("\n--- clauses de contrat ---");

// Prime d'échange : l'équipe qui reçoit compte le joueur majoré.
{
  const roster = [player(1, "AA", "BOS", 20_000_000), player(3, "CC", "LAL", 20_000_000)];
  const flags: Record<number, PlayerTradeFlags> = { 1: { tradeBonusPct: 15 } };
  const e = evaluateTrade({
    ...base({ BOS: 170_000_000, LAL: 170_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "BOS" },
    ],
    roster,
    flags,
  });
  check("prime de 15 % -> entrant majoré chez LAL", e.teams[1].incomingSalary, 23_000_000);
  check("  ... et sortant inchangé chez BOS", e.teams[0].outgoingSalary, 20_000_000);
}

// Base year compensation : le sortant vaut moins que le contrat.
{
  const p = player(1, "AA", "BOS", 20_000_000);
  check("BYC sans ancien salaire -> moitié du nouveau", outgoingValue(p, { byc: true }), 10_000_000);
  check(
    "BYC avec ancien salaire supérieur -> l'ancien",
    outgoingValue(p, { byc: true, priorSalary: 14_000_000 }),
    14_000_000
  );
}

// Contrat au minimum : hors concordance, même au second apron.
{
  const roster = [player(1, "AA", "BOS", 1_200_000), player(3, "CC", "LAL", 1_200_000)];
  check("détection auto d'un minimum recrue", isMinimumContract(roster[0], undefined, A), true);
  const e = evaluateTrade({
    ...base({ BOS: 215_000_000, LAL: 215_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "BOS" },
    ],
    roster,
  });
  check("échange de minimums au second apron -> valide", e.verdict, "valid");
  check("  entrant hors concordance", e.teams[0].exemptIncoming, 1_200_000);
  check("  entrant à faire concorder", e.teams[0].incomingSalary, 0);
}

// Contrat two-way : ni concordance ni place dans les quinze.
{
  const roster = [player(1, "AA", "BOS", 600_000), player(3, "CC", "LAL", 30_000_000)];
  const e = evaluateTrade({
    ...base({ BOS: 215_000_000, LAL: 150_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [{ playerId: 1, from: "BOS", to: "LAL" }],
    roster,
    flags: { 1: { twoWay: true } },
  });
  check("two-way -> sortant compté 0", e.teams[0].outgoingSalary, 0);
  check("  ... et hors masse salariale", e.teams[0].payrollAfter, 215_000_000);
}

// Clause de non-échange : l'échange devient conditionnel.
{
  const roster = [player(1, "AA", "BOS", 20_000_000), player(3, "CC", "LAL", 20_000_000)];
  const e = evaluateTrade({
    ...base({ BOS: 170_000_000, LAL: 170_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "BOS" },
    ],
    roster,
    flags: { 1: { restriction: "no-trade" } },
  });
  check("clause de non-échange -> sous conditions", e.verdict, "conditional");
  check("  accord requis identifié", e.teams[0].consentRequired.length, 1);
}

// Délai de carence : l'échange est impossible.
{
  const roster = [player(1, "AA", "BOS", 20_000_000), player(3, "CC", "LAL", 20_000_000)];
  const e = evaluateTrade({
    ...base({ BOS: 170_000_000, LAL: 170_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "BOS" },
    ],
    roster,
    flags: { 1: { restriction: "dec15" } },
  });
  check("carence du 15 décembre -> invalide", e.verdict, "invalid");
}

/* ════════════════ Liquidités ════════════════ */
console.log("\n--- liquidités ---");

const cashRoster = [player(1, "AA", "BOS", 20_000_000), player(3, "CC", "LAL", 20_000_000)];
const cashMoves = [
  { playerId: 1, from: "BOS", to: "LAL" },
  { playerId: 3, from: "LAL", to: "BOS" },
];

// Au-delà du plafond annuel.
{
  const e = evaluateTrade({
    ...base({ BOS: 170_000_000, LAL: 170_000_000 }),
    teams: ["BOS", "LAL"],
    moves: cashMoves,
    roster: cashRoster,
    cash: [{ from: "BOS", to: "LAL", amount: 9_000_000 }],
  });
  check("9 M$ de liquidités -> au-delà du plafond", hasError(e, "plafond annuel"), true);
}
// Compteur de saison déjà entamé.
{
  const e = evaluateTrade({
    ...base({ BOS: 170_000_000, LAL: 170_000_000 }),
    teams: ["BOS", "LAL"],
    moves: cashMoves,
    roster: cashRoster,
    cash: [{ from: "BOS", to: "LAL", amount: 4_000_000 }],
    cashUsed: { BOS: { sent: 5_000_000 } },
  });
  check("compteur de saison pris en compte", hasError(e, "plafond annuel"), true);
}
// Sous le plafond : autorisé, mais l'équipe se verrouille au second apron.
{
  const e = evaluateTrade({
    ...base({ BOS: 170_000_000, LAL: 170_000_000 }),
    teams: ["BOS", "LAL"],
    moves: cashMoves,
    roster: cashRoster,
    cash: [{ from: "BOS", to: "LAL", amount: 2_000_000 }],
  });
  check("2 M$ de liquidités -> valide", e.verdict, "valid");
  check("  verrou au second apron", e.teams[0].hardCap, "second");
}
// Une équipe au second apron ne peut rien verser.
{
  const e = evaluateTrade({
    ...base({ BOS: 215_000_000, LAL: 170_000_000 }),
    teams: ["BOS", "LAL"],
    moves: cashMoves,
    roster: cashRoster,
    cash: [{ from: "BOS", to: "LAL", amount: 1_000_000 }],
  });
  check("second apron verse des liquidités -> invalide", hasError(e, "ne peut pas verser"), true);
}

/* ════════════════ Choix de draft ════════════════ */
console.log("\n--- choix de draft ---");

const picks = buildPickInventory(["BOS", "LAL"], SEASON);
const pickRoster = [player(1, "AA", "BOS", 20_000_000), player(3, "CC", "LAL", 20_000_000)];
const pickBase = {
  ...base({ BOS: 170_000_000, LAL: 170_000_000 }),
  teams: ["BOS", "LAL"],
  moves: cashMoves,
  roster: pickRoster,
  picks,
};

check("fenêtre de 7 drafts pour 2025-26", [picks[0].year, picks[picks.length - 1].year], [2026, 2032]);

// Un second tour part sans contrainte.
{
  const e = evaluateTrade({
    ...pickBase,
    pickMoves: [{ pickId: "BOS-2027-2", from: "BOS", to: "LAL" }],
  });
  check("second tour échangé -> valide", e.verdict, "valid");
  check("  compté chez LAL", e.teams[1].incomingPicks.length, 1);
}
// Deux premiers tours consécutifs : règle Stepien.
{
  const e = evaluateTrade({
    ...pickBase,
    pickMoves: [
      { pickId: "BOS-2027-1", from: "BOS", to: "LAL" },
      { pickId: "BOS-2028-1", from: "BOS", to: "LAL" },
    ],
  });
  check("deux 1ers tours consécutifs -> Stepien", hasError(e, "Stepien"), true);
}
// Une année sur deux : autorisé.
{
  const e = evaluateTrade({
    ...pickBase,
    pickMoves: [
      { pickId: "BOS-2027-1", from: "BOS", to: "LAL" },
      { pickId: "BOS-2029-1", from: "BOS", to: "LAL" },
    ],
  });
  check("1ers tours en années alternées -> valide", e.verdict, "valid");
}
// Détenir le choix d'une autre franchise régularise.
{
  const e = evaluateTrade({
    ...pickBase,
    pickMoves: [
      { pickId: "BOS-2027-1", from: "BOS", to: "LAL" },
      { pickId: "BOS-2028-1", from: "BOS", to: "LAL" },
      { pickId: "LAL-2028-1", from: "LAL", to: "BOS" },
    ],
  });
  check("un 1er tour acquis lève Stepien", hasError(e, "Stepien"), false);
}
// Règle des sept ans.
{
  const e = evaluateTrade({
    ...pickBase,
    picks: [...picks, { id: "BOS-2035-1", originalTeam: "BOS", owner: "BOS", year: 2035, round: 1 } as DraftPickAsset],
    pickMoves: [{ pickId: "BOS-2035-1", from: "BOS", to: "LAL" }],
  });
  check("choix hors fenêtre -> règle des sept ans", hasError(e, "sept drafts"), true);
}
// Gel du 1er tour à sept ans au second apron.
{
  const e = evaluateTrade({
    ...pickBase,
    payrollBase: { BOS: 215_000_000, LAL: 170_000_000 },
    pickMoves: [{ pickId: "BOS-2032-1", from: "BOS", to: "LAL" }],
  });
  check("1er tour 2032 gelé au second apron", hasError(e, "gelé"), true);
}
// Le même choix, équipe sous le second apron : rien à signaler.
{
  const e = evaluateTrade({
    ...pickBase,
    pickMoves: [{ pickId: "BOS-2032-1", from: "BOS", to: "LAL" }],
  });
  check("1er tour 2032 hors second apron -> valide", e.verdict, "valid");
}
// On ne cède pas un choix qu'on ne détient pas.
{
  const e = evaluateTrade({
    ...pickBase,
    pickMoves: [{ pickId: "LAL-2027-1", from: "BOS", to: "LAL" }],
  });
  check("choix non détenu -> invalide", hasError(e, "ne détient pas"), true);
}

/* ════════════════ Exception d'échange et fenêtre ════════════════ */
console.log("\n--- exception d'échange, fenêtre ---");

// Une exception déclarée absorbe un salaire sans rien renvoyer.
{
  const roster = [player(3, "CC", "LAL", 5_000_000), player(1, "AA", "BOS", 20_000_000)];
  const e = evaluateTrade({
    ...base({ BOS: 205_000_000, LAL: 150_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [{ playerId: 3, from: "LAL", to: "BOS" }],
    roster,
    tradeExceptions: { BOS: 6_000_000 },
  });
  check("exception d'échange -> absorption valide", e.verdict, "valid");
  check("  part utilisée", e.teams[0].tradeExceptionUsed, 6_000_000);
}
// Sans elle, la même absorption est illégale.
{
  const roster = [player(3, "CC", "LAL", 5_000_000), player(1, "AA", "BOS", 20_000_000)];
  const e = evaluateTrade({
    ...base({ BOS: 205_000_000, LAL: 150_000_000 }),
    teams: ["BOS", "LAL"],
    moves: [{ playerId: 3, from: "LAL", to: "BOS" }],
    roster,
  });
  check("sans exception -> invalide", e.verdict, "invalid");
}
// Fenêtre fermée : rien ne passe.
{
  const e = evaluateTrade({
    ...base({ BOS: 170_000_000, LAL: 170_000_000 }),
    teams: ["BOS", "LAL"],
    moves: cashMoves,
    roster: cashRoster,
    window: { open: false, label: "La trade deadline est passée." },
  });
  check("fenêtre fermée -> invalide", e.verdict, "invalid");
  check("  motif global", e.globalIssues.some((i) => i.message.includes("trade deadline")), true);
}

/* ════════════════ Aller-retour URL ════════════════ */
console.log("\n--- encode / decode ---");

{
  const teams = ["BOS", "LAL"];
  const moves = [
    { playerId: 1, from: "BOS", to: "LAL" },
    { playerId: 3, from: "LAL", to: "BOS" },
  ];
  const pickMoves = [{ pickId: "BOS-2029-1", from: "BOS", to: "LAL" }];
  const cash = [{ from: "BOS", to: "LAL", amount: 2_000_000 }];
  const flags: Record<number, PlayerTradeFlags> = {
    1: { tradeBonusPct: 15, restriction: "no-trade" },
    3: { byc: true, priorSalary: 8_000_000 },
  };
  const tradeExceptions = { BOS: 5_000_000 };

  const q = encodeTrade(teams, moves, { pickMoves, cash, flags, tradeExceptions });
  const p = new URLSearchParams(q);
  const back = decodeTrade(
    {
      teams: p.get("teams") ?? undefined,
      moves: p.get("moves") ?? undefined,
      picks: p.get("picks") ?? undefined,
      cash: p.get("cash") ?? undefined,
      flags: p.get("flags") ?? undefined,
      tpe: p.get("tpe") ?? undefined,
    },
    (id) => (id === 1 ? "BOS" : id === 3 ? "LAL" : undefined),
    (pickId) => pickId.split("-")[0]
  );

  check("aller-retour URL : équipes", back.teams, teams);
  check("aller-retour URL : joueurs", back.moves, moves);
  check("aller-retour URL : choix", back.pickMoves, pickMoves);
  check("aller-retour URL : liquidités", back.cash, cash);
  check("aller-retour URL : clauses", back.flags, flags);
  check("aller-retour URL : exceptions", back.tradeExceptions, tradeExceptions);
}
{
  // Joueur inconnu, équipe hors échange, doublon : ignorés proprement.
  const back = decodeTrade(
    { teams: "BOS,LAL", moves: "999-LAL,1-PHX,1-LAL,1-LAL" },
    (id) => (id === 1 ? "BOS" : undefined)
  );
  check("décodage robuste", back.moves, [{ playerId: 1, from: "BOS", to: "LAL" }]);
}

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail > 0 ? 1 : 0);
