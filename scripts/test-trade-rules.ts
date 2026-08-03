import { evaluateTrade, salaryMatchLimit, decodeTrade, encodeTrade, type TradeRosterPlayer } from "../src/lib/trade-rules";
import { capThresholds } from "../src/lib/salary-cap";

const T = capThresholds("2025-26");
const M = (n: number) => (n / 1e6).toFixed(2) + "M";

function player(id: number, name: string, team: string, salary: number | null, pts = 10): TradeRosterPlayer {
  return {
    player_id: id, first_name: "P", last_name: name, team_tricode: team,
    team_city: team, team_name: "Team", position: "F", age: 27,
    salary, pts, reb: 5, ast: 3,
  };
}

let pass = 0, fail = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`}`);
  ok ? pass++ : fail++;
}

console.log("Seuils:", { cap: M(T.salaryCap), tax: M(T.luxuryTax), a1: M(T.firstApron), a2: M(T.secondApron) });

/* ── salaryMatchLimit ── */
console.log("\n--- salaryMatchLimit ---");

// Équipe très en dessous du cap : absorbe dans son espace.
{
  const r = salaryMatchLimit(100_000_000, 0, T);
  check("sous le cap, rien envoyé -> absorbe l'espace cap", [r.key, Math.round(r.limit)], ["cap-space", T.salaryCap - 100_000_000]);
}
// Équipe au-dessus du cap, loin de l'apron : 125 % + 250k.
{
  const r = salaryMatchLimit(170_000_000, 20_000_000, T);
  check("over cap, sous apron -> 125% + 250k", [r.key, Math.round(r.limit)], ["tpe-125", 25_250_000]);
}
// Équipe au-dessus du 1er apron : dollar pour dollar.
{
  const r = salaryMatchLimit(200_000_000, 20_000_000, T);
  check("au-dessus du 1er apron -> 100%", [r.key, Math.round(r.limit)], ["apron-100", 20_000_000]);
}
// Rien envoyé et aucune marge : ne peut rien recevoir (pas de 250k fantôme).
{
  const r = salaryMatchLimit(200_000_000, 0, T);
  check("apron, rien envoyé -> limite 0", [r.key, r.limit], ["none", 0]);
}
// La règle des 125 % ne doit jamais faire franchir le 1er apron.
{
  const payroll = 190_000_000, out = 20_000_000;
  const r = salaryMatchLimit(payroll, out, T);
  const payrollAfter = payroll - out + r.limit;
  check("125% plafonné au 1er apron", payrollAfter <= T.firstApron, true);
  check("  ... et >= 100% du sortant", r.limit >= out, true);
}

/* ── evaluateTrade ── */
console.log("\n--- evaluateTrade ---");

// 1. Échange équilibré entre deux équipes au-dessus du cap : valide.
{
  const roster = [
    player(1, "AA", "BOS", 30_000_000), player(2, "BB", "BOS", 5_000_000),
    player(3, "CC", "LAL", 29_000_000), player(4, "DD", "LAL", 5_000_000),
  ];
  const e = evaluateTrade({
    season: "2025-26", teams: ["BOS", "LAL"],
    moves: [{ playerId: 1, from: "BOS", to: "LAL" }, { playerId: 3, from: "LAL", to: "BOS" }],
    roster, payrollBase: { BOS: 170_000_000, LAL: 170_000_000 },
  });
  check("échange équilibré (over cap) -> valide", e.verdict, "valid");
  check("  masse BOS après", e.teams[0].payrollAfter, 169_000_000);
}

// 2. Équipe au-dessus de l'apron qui reçoit plus qu'elle n'envoie : invalide.
{
  const roster = [player(1, "AA", "BOS", 10_000_000), player(3, "CC", "LAL", 30_000_000)];
  const e = evaluateTrade({
    season: "2025-26", teams: ["BOS", "LAL"],
    moves: [{ playerId: 1, from: "BOS", to: "LAL" }, { playerId: 3, from: "LAL", to: "BOS" }],
    roster, payrollBase: { BOS: 205_000_000, LAL: 150_000_000 },
  });
  check("apron reçoit plus qu'il n'envoie -> invalide", e.verdict, "invalid");
  check("  BOS a une erreur de concordance", e.teams[0].issues.some(i => i.level === "error" && i.message.includes("Maximum autorisé")), true);
}

// 3. Équipe au second apron qui agrège deux contrats : invalide.
{
  const roster = [
    player(1, "AA", "BOS", 15_000_000), player(2, "BB", "BOS", 15_000_000),
    player(3, "CC", "LAL", 30_000_000),
  ];
  const e = evaluateTrade({
    season: "2025-26", teams: ["BOS", "LAL"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" }, { playerId: 2, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "BOS" },
    ],
    roster, payrollBase: { BOS: 210_000_000, LAL: 150_000_000 },
  });
  check("second apron agrège 2 contrats -> invalide", e.verdict, "invalid");
  check("  message d'agrégation présent", e.teams[0].issues.some(i => i.message.includes("agréger")), true);
}

// 4. Équipe sous le cap qui absorbe un contrat sans rien renvoyer : valide.
{
  const roster = [player(1, "AA", "BOS", 30_000_000), player(9, "ZZ", "UTA", 2_000_000)];
  const e = evaluateTrade({
    season: "2025-26", teams: ["BOS", "UTA"],
    moves: [{ playerId: 1, from: "BOS", to: "UTA" }],
    roster, payrollBase: { BOS: 190_000_000, UTA: 110_000_000 },
  });
  check("absorption dans l'espace cap -> valide", e.verdict, "valid");
  check("  règle retenue", e.teams[1].matchRule.key, "cap-space");
}

// 5. Contrat inconnu -> verdict incomplet, pas invalide.
{
  const roster = [player(1, "AA", "BOS", null), player(3, "CC", "LAL", 5_000_000)];
  const e = evaluateTrade({
    season: "2025-26", teams: ["BOS", "LAL"],
    moves: [{ playerId: 1, from: "BOS", to: "LAL" }, { playerId: 3, from: "LAL", to: "BOS" }],
    roster, payrollBase: { BOS: 150_000_000, LAL: 150_000_000 },
  });
  check("contrat inconnu -> incomplet", e.verdict, "incomplete");
  check("  signalé comme avertissement", e.teams[0].issues.every(i => i.level === "warning"), true);
}

// 6. Équipe présente mais qui ne participe pas -> invalide.
{
  const roster = [player(1, "AA", "BOS", 5_000_000), player(3, "CC", "LAL", 5_000_000), player(5, "EE", "NYK", 5_000_000)];
  const e = evaluateTrade({
    season: "2025-26", teams: ["BOS", "LAL", "NYK"],
    moves: [{ playerId: 1, from: "BOS", to: "LAL" }, { playerId: 3, from: "LAL", to: "BOS" }],
    roster, payrollBase: { BOS: 150_000_000, LAL: 150_000_000, NYK: 150_000_000 },
  });
  check("équipe inactive -> invalide", e.verdict, "invalid");
  check("  message cible NYK", e.teams[2].issues.some(i => i.message.includes("ne participe pas")), true);
}

// 7. Échange à trois équipes, valide.
{
  const roster = [
    player(1, "AA", "BOS", 20_000_000), player(3, "CC", "LAL", 20_000_000), player(5, "EE", "NYK", 20_000_000),
  ];
  const e = evaluateTrade({
    season: "2025-26", teams: ["BOS", "LAL", "NYK"],
    moves: [
      { playerId: 1, from: "BOS", to: "LAL" },
      { playerId: 3, from: "LAL", to: "NYK" },
      { playerId: 5, from: "NYK", to: "BOS" },
    ],
    roster, payrollBase: { BOS: 170_000_000, LAL: 170_000_000, NYK: 170_000_000 },
  });
  check("échange à 3 équipes équilibré -> valide", e.verdict, "valid");
}

// 8. Aucun mouvement -> vide.
{
  const e = evaluateTrade({ season: "2025-26", teams: ["BOS", "LAL"], moves: [], roster: [], payrollBase: {} });
  check("aucun mouvement -> vide", e.verdict, "empty");
}

// 9. Production nette : les stats suivent bien les joueurs.
{
  const roster = [player(1, "AA", "BOS", 20_000_000, 30), player(3, "CC", "LAL", 20_000_000, 10)];
  const e = evaluateTrade({
    season: "2025-26", teams: ["BOS", "LAL"],
    moves: [{ playerId: 1, from: "BOS", to: "LAL" }, { playerId: 3, from: "LAL", to: "BOS" }],
    roster, payrollBase: { BOS: 170_000_000, LAL: 170_000_000 },
  });
  check("PTS nets BOS", e.teams[0].ptsIn - e.teams[0].ptsOut, -20);
  check("PTS nets LAL", e.teams[1].ptsIn - e.teams[1].ptsOut, 20);
}

/* ── URL round-trip ── */
console.log("\n--- encode / decode ---");
{
  const teams = ["BOS", "LAL"];
  const moves = [{ playerId: 1, from: "BOS", to: "LAL" }, { playerId: 3, from: "LAL", to: "BOS" }];
  const q = encodeTrade(teams, moves);
  const owner = (id: number) => (id === 1 ? "BOS" : id === 3 ? "LAL" : undefined);
  const params = new URLSearchParams(q);
  const back = decodeTrade(params.get("teams") ?? undefined, params.get("moves") ?? undefined, owner);
  check("aller-retour URL", back, { teams, moves });
}
{
  // Joueur inconnu / équipe hors échange : ignorés proprement.
  const back = decodeTrade("BOS,LAL", "999-LAL,1-PHX,1-LAL,1-LAL", (id) => (id === 1 ? "BOS" : undefined));
  check("décodage robuste", back.moves, [{ playerId: 1, from: "BOS", to: "LAL" }]);
}

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail > 0 ? 1 : 0);
