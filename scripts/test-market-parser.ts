/**
 * Vérifie le parseur du journal des mouvements sur des cas réels.
 *
 * Deux modes :
 *   npm run test:market                    # cas fixes, hors réseau
 *   npm run test:market -- 2025-26 2015-16 # + pages réelles de Basketball Reference
 *
 * Le mode réseau ne pose pas d'assertion sur des chiffres exacts — BR complète
 * ses pages en continu. Il vérifie des invariants : chaque mouvement a une date,
 * un type, et les échanges ont un sens de circulation identifiable.
 */

import {
  classifyKind,
  detectContract,
  eventKey,
  fetchSeasonTransactions,
  parseBrDate,
  parseTransaction,
  parseTransactionsPage,
} from "../src/lib/br-transactions";
import { fetchDraft, parseDraftPage } from "../src/lib/br-draft";
import { buildLotteryBoard, lotteryOdds } from "../src/lib/lottery";
import { resolveCollege } from "../src/lib/market-sync";
import { classifyEspn, parseEspnSentence, playersInText, splitSentences, teamInText } from "../src/lib/espn-transactions";
import { eventAction, isMinorMove, KIND_LABELS, MINOR_KINDS, rosterMoves, semanticKey, type MarketEvent } from "../src/lib/market";
import { estimateSeasonPhases, phaseForDate, seasonForEventDate } from "../src/lib/season-phases";
import { seasonStartYear } from "../src/lib/season";

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        attendu ${JSON.stringify(expected)}\n        obtenu  ${JSON.stringify(actual)}`)
  );
  ok ? pass++ : fail++;
}

/* ── Dates et rattachement de saison ── */
console.log("--- dates ---");
check("date BR", parseBrDate("July 2, 2025"), "2025-07-02");
check("date BR à un chiffre", parseBrDate("May 9, 2016"), "2016-05-09");
check("date invalide", parseBrDate("Juillet 2, 2025"), null);
check("signature de juillet -> saison qui s'ouvre", seasonForEventDate("2025-07-02"), "2025-26");
check("échange de février -> saison en cours", seasonForEventDate("2026-02-05"), "2025-26");
check("draft de fin juin -> saison qui s'ouvre", seasonForEventDate("2025-06-25"), "2025-26");
check("Finales de début juin -> saison en cours", seasonForEventDate("2025-06-10"), "2024-25");

/* ── Périodes ── */
console.log("\n--- périodes ---");
{
  const phases = estimateSeasonPhases("2025-26");
  const draft = phases.find((p) => p.phase === "draft")!;
  check("fenêtre de draft en juin 2025", [draft.startsOn, draft.endsOn], ["2025-06-20", "2025-06-29"]);
  check("date limite estimée en février 2026", phases.find((p) => p.phase === "trade_deadline")!.startsOn.slice(0, 7), "2026-02");
  check("free agency ouvre le 30 juin", phases.find((p) => p.phase === "free_agency")!.startsOn, "2025-06-30");
  check("un jour de draft est rangé dans la draft", phaseForDate(draft.startsOn, phases), "draft");
  check("un jour de juillet est rangé dans la free agency", phaseForDate("2025-07-15", phases), "free_agency");
  check("un jour de décembre est rangé dans la saison régulière", phaseForDate("2025-12-10", phases), "regular_season");

  // Les échanges de la nuit de draft tombent sur la vraie date du tirage, jamais
  // sur celle qu'on estime : seule une fenêtre les attrape.
  check("échange de la nuit de draft rangé dans la draft", phaseForDate("2025-06-25", phases), "draft");
  check("draft de fin juin aussi", phaseForDate("2025-06-26", phases), "draft");

  // La loterie appartient à la fenêtre de la saison, donc à mai de l'année
  // suivante : en mai 2025 elle serait rattachée à la saison 2024-25 et son
  // compteur resterait nul par construction.
  const lottery = phases.find((p) => p.phase === "lottery")!;
  check("loterie en mai 2026", lottery.startsOn.slice(0, 7), "2026-05");
  check("le jour de loterie est rangé dans la loterie", phaseForDate(lottery.startsOn, phases), "lottery");
  check("la loterie tombe dans la saison qu'elle clôt", seasonForEventDate(lottery.startsOn), "2025-26");

  // Aucun trou : chaque jour de la fenêtre de rattachement doit tomber quelque
  // part, play-in et lendemain des Finales compris.
  const orphans: string[] = [];
  for (let d = new Date("2025-06-20T12:00:00Z"); d <= new Date("2026-06-19T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    if (!phaseForDate(day, phases)) orphans.push(day);
  }
  check("aucun jour sans période sur la fenêtre de la saison", orphans, []);
}
{
  // La free agency 2022-23 s'ouvrait le 1er juillet, avant la convention 2023.
  const phases = estimateSeasonPhases("2022-23");
  check("free agency 2022 ouvre le 1er juillet", phases.find((p) => p.phase === "free_agency")!.startsOn, "2022-07-01");
}

/* ── Classification ── */
console.log("\n--- classification ---");
check("échange", classifyKind("The Golden State Warriors traded Justinian Jessup to the Memphis Grizzlies for Will Richard."), "trade");
check("ballottage, pas une coupe", classifyKind("The Phoenix Suns claimed Jordan Goodwin on waivers from the Los Angeles Lakers."), "claim");
check("coupe", classifyKind("The Toronto Raptors waived Jared Rhoden."), "waiver");
check("conversion", classifyKind("The Atlanta Hawks converted Keaton Wallace from a two-way contract to a regular contract."), "conversion");
check("signature", classifyKind("The Philadelphia 76ers signed Eric Gordon."), "signature");
check("G League aller", classifyKind("The Boston Celtics assigned Jordan Walsh to the Maine Red Claws of the G-League."), "assignment");
check("G League retour", classifyKind("The Boston Celtics recalled Jordan Walsh from the Maine Red Claws of the G-League."), "recall");
check("retraite", classifyKind("John Wall announced retirement."), "retirement");
check("suspension", classifyKind("Rudy Gobert was suspended by the league. (1-game suspension)"), "suspension");
check("limogeage", classifyKind("The Houston Rockets fired Kevin McHale as Head Coach."), "coaching");
check("nomination", classifyKind("The Minnesota Timberwolves appointed Sam Mitchell as Head Coach."), "coaching");

check("two-way détecté", detectContract("signed X to a two-way contract.", "signature"), { type: "two_way", detail: null });
check("10 jours détecté", detectContract("signed X to a 10-day contract.", "signature"), { type: "ten_day", detail: null });
check("contrat non précisé reste inconnu", detectContract("signed Eric Gordon.", "signature"), null);
check("conversion vers un contrat standard", detectContract("converted X from a two-way contract to a regular contract.", "conversion"), { type: "standard", detail: null });

/* ── Découpage complet, sur du HTML réel de BR ── */
console.log("\n--- mouvements ---");

const TRADE = `<p>The <a data-attr-from="GSW" href="/teams/GSW/2026.html">Golden State Warriors</a> traded <a href="/players/j/jessuju01.html">Justinian Jessup</a>, <a href="/players/m/mashaja01.html">Jahmai Mashack</a> and a 2032 2nd round draft pick to the <a data-attr-to="MEM" href="/teams/MEM/2026.html">Memphis Grizzlies</a> for <a href="/players/r/richawi02.html">Will Richard</a>. 2032 2nd-rd pick is GSW own</p>`;
{
  const e = parseTransaction(TRADE, "2025-07-06")!;
  check("type", e.kind, "trade");
  check("équipes", e.teams, ["GSW", "MEM"]);
  check("sujet et destinataire", [e.from_team, e.to_team], ["GSW", "MEM"]);
  check("joueurs cédés", e.players.filter((p) => p.from === "GSW").map((p) => p.name), ["Justinian Jessup", "Jahmai Mashack"]);
  check("joueur reçu", e.players.filter((p) => p.to === "GSW").map((p) => p.name), ["Will Richard"]);
  check("choix cédé", e.assets.map((a) => [a.type, a.year, a.round, a.from, a.to]), [["pick", 2032, 2, "GSW", "MEM"]]);
  check("note du choix rattachée", e.assets[0].detail, "2032 2nd-rd pick is GSW own");
  check("phrase française", eventAction(e as unknown as MarketEvent), "envoie Justinian Jessup, Jahmai Mashack et 2e tour 2032 à MEM contre Will Richard");
}

// Annotation rétrospective de BR : le joueur cité n'a pas été échangé, il a été
// sélectionné plus tard avec le choix cédé. Le compter comme joueur échangé
// faisait « échanger » en 2015 un joueur encore à l'université.
const ANNOTATED = `<p>The <a data-attr-from="DET" href="/teams/DET/2016.html">Detroit Pistons</a> traded a 2020 2nd round draft pick (<a href="/players/t/tillmxa01.html">Xavier Tillman Sr.</a> was later selected) to the <a data-attr-to="PHO" href="/teams/PHO/2016.html">Phoenix Suns</a> for <a href="/players/b/bullore01.html">Reggie Bullock</a>, <a href="/players/g/grangda01.html">Danny Granger</a> and <a href="/players/m/morrima03.html">Marcus Morris</a>.</p>`;
{
  const e = parseTransaction(ANNOTATED, "2015-07-09")!;
  check("annotation : joueur futur exclu des participants", e.players.map((p) => p.name).includes("Xavier Tillman Sr."), false);
  check("annotation : joueurs reçus", e.players.filter((p) => p.to === "DET").map((p) => p.name), ["Reggie Bullock", "Danny Granger", "Marcus Morris"]);
  check("annotation : le choix reste cédé", e.assets.map((a) => [a.type, a.year, a.round, a.from, a.to]), [["pick", 2020, 2, "DET", "PHX"]]);
  check("annotation : conservée comme note du choix", e.assets[0].detail, "Xavier Tillman Sr. sélectionné avec ce choix");
  check("annotation : texte brut intact", e.raw.includes("was later selected"), true);
  check("annotation : phrase", eventAction(e as unknown as MarketEvent), "envoie 2e tour 2020 à PHX contre Reggie Bullock, Danny Granger et Marcus Morris");
}

const SUSPENSION = `<p><a href="/players/g/goberru01.html">Rudy Gobert</a> was suspended by the league. (1-game suspension)</p>`;
{
  const e = parseTransaction(SUSPENSION, "2026-01-12")!;
  check("suspension : type et durée", [e.kind, e.detail], ["suspension", "1 match"]);
  check("suspension : aucun mouvement d'équipe", [e.from_team, e.to_team], [null, null]);
  check("suspension : phrase", eventAction(e as unknown as MarketEvent), "Rudy Gobert suspendu par la ligue (1 match)");
}

const COACH = `<p>The <a data-attr-from="HOU" href="/teams/HOU/2016.html">Houston Rockets</a> fired <a href="/coaches/mchalke01c.html">Kevin McHale</a> as Head Coach.</p>`;
{
  const e = parseTransaction(COACH, "2015-11-18")!;
  check("encadrement : type", e.kind, "coaching");
  check("encadrement : équipe concernée", e.teams, ["HOU"]);
  check("encadrement : rôle non joueur", e.players.map((p) => [p.name, p.role]), [["Kevin McHale", "coach"]]);
  check("encadrement : phrase", eventAction(e as unknown as MarketEvent), "limoge son entraîneur principal Kevin McHale");
}

const SIGN = `<p>The <a data-attr-to="MIN" href="/teams/MIN/2026.html">Minnesota Timberwolves</a> signed <a href="/players/b/bernaju01.html">Jules Bernard</a> to a two-way contract.</p>`;
{
  const e = parseTransaction(SIGN, "2025-02-25")!;
  check("signature : équipe d'arrivée", [e.from_team, e.to_team], [null, "MIN"]);
  check("signature : joueur qui arrive", e.players.map((p) => [p.name, p.from, p.to]), [["Jules Bernard", null, "MIN"]]);
  check("signature : phrase", eventAction(e as unknown as MarketEvent), "signe Jules Bernard (two-way)");
}

const WAIVE = `<p>The <a data-attr-from="TOR" href="/teams/TOR/2026.html">Toronto Raptors</a> waived <a href="/players/r/rhodeja01.html">Jared Rhoden</a>.</p>`;
{
  const e = parseTransaction(WAIVE, "2025-10-18")!;
  check("coupe : équipe de départ", [e.from_team, e.to_team], ["TOR", null]);
  check("coupe : phrase", eventAction(e as unknown as MarketEvent), "coupe Jared Rhoden");
}

const CLAIM = `<p>The <a data-attr-to="PHO" href="/teams/PHO/2026.html">Phoenix Suns</a> claimed <a href="/players/g/goodwjo01.html">Jordan Goodwin</a> on waivers from the <a data-attr-from="LAL" href="/teams/LAL/2026.html">Los Angeles Lakers</a>.</p>`;
{
  const e = parseTransaction(CLAIM, "2025-10-22")!;
  check("ballottage : les deux équipes", [e.from_team, e.to_team], ["LAL", "PHX"]);
  check("ballottage : tricode BR converti", e.teams.includes("PHX"), true);
  check("ballottage : phrase", eventAction(e as unknown as MarketEvent), "récupère Jordan Goodwin au ballottage (depuis LAL)");
}

const RETIRE = `<p><a href="/players/w/walljo01.html">John Wall</a> announced retirement.</p>`;
{
  const e = parseTransaction(RETIRE, "2025-08-12")!;
  check("retraite : aucune équipe", [e.teams.length, e.from_team], [0, null]);
  check("retraite : phrase", eventAction(e as unknown as MarketEvent), "John Wall met un terme à sa carrière");
}

// Ligne incomplète telle que BR en produit : ne doit ni casser ni disparaître.
const BROKEN = `<p>The traded FROM_TRADE to the <a data-attr-to="MIN" href="/teams/MIN/2026.html">Minnesota Timberwolves</a>. 2027 2nd-rd pick is CLE own Minnesota received a trade exception.</p>`;
{
  const e = parseTransaction(BROKEN, "2025-07-06")!;
  check("ligne cassée : conservée", e !== null, true);
  check("ligne cassée : type reconnu", e.kind, "trade");
  check("ligne cassée : texte brut conservé", e.raw.startsWith("The traded FROM_TRADE"), true);
}

/* ── Empreinte ── */
console.log("\n--- empreinte ---");
{
  const a = eventKey("2025-07-06", "The Toronto Raptors waived Jared Rhoden.");
  const b = eventKey("2025-07-06", "the toronto raptors  waived jared rhoden. ");
  check("insensible à la casse et aux espaces", a === b, true);
  check("dépend de la date", eventKey("2025-07-07", "x") === eventKey("2025-07-06", "x"), false);
}

/* ── Page entière ── */
{
  const html = `<li><span>July 2, 2025</span>${SIGN}${WAIVE}</li><li><span>February 5, 2026</span>${TRADE}</li>`;
  const events = parseTransactionsPage(html);
  check("page : trois mouvements", events.length, 3);
  check("page : dates lues", [...new Set(events.map((e) => e.event_date))].sort(), ["2025-07-02", "2026-02-05"]);
  check("page : saisons rattachées", [...new Set(events.map((e) => e.season))], ["2025-26"]);
}

/* ── Draft ── */
console.log("\n--- draft ---");
{
  const html = `
    <tr class="over_header"><th data-stat="header_draft" colspan="2">Round 1</th></tr>
    <tr><th data-stat="ranker">1</th><td data-stat="pick_overall">1</td><td data-stat="team_id"><a href="/teams/DAL/2026.html">DAL</a></td><td data-stat="player" ><a href="/players/f/flagoco01.html">Cooper Flagg</a></td><td data-stat="college_name"><a href="/friv/colleges.fcgi">Duke</a></td></tr>
    <tr class="over_header thead"><th data-stat="header_draft" colspan="2">Round 2</th></tr>
    <tr><th data-stat="ranker">31</th><td data-stat="pick_overall">31</td><td data-stat="team_id">PHO</td><td data-stat="player">Rasheer Fleming</td><td data-stat="college_name">Saint Joseph's</td></tr>`;
  const picks = parseDraftPage(html, 2025);
  check("draft : deux choix lus", picks.length, 2);
  check("draft : premier choix", [picks[0].pick_overall, picks[0].round, picks[0].team_tricode, picks[0].player_name, picks[0].college], [1, 1, "DAL", "Cooper Flagg", "Duke"]);
  check("draft : identifiant BR du joueur", picks[0].br_slug, "flagoco01");
  check("draft : saison ouverte par la draft", picks[0].season, "2025-26");
  check("draft : second tour reconnu", [picks[1].round, picks[1].pick_in_round], [2, 1]);
  check("draft : tricode BR converti", picks[1].team_tricode, "PHX");
}
{
  // Choix non exercé (sanction de la ligue) : le rang existe sans joueur.
  const html = `<tr><td data-stat="pick_overall">60</td><td data-stat="team_id">NYK</td><td data-stat="player"></td></tr>
    <tr><td data-stat="pick_overall">99</td><td data-stat="team_id"></td><td data-stat="player">Ligne de mise en forme</td></tr>`;
  const picks = parseDraftPage(html, 2025);
  check("draft : choix non exercé conservé", picks.map((p) => [p.pick_overall, p.team_tricode, p.player_name]), [[60, "NYK", null]]);
}

/* ── Lecture d'ESPN ── */
console.log("\n--- ESPN ---");
{
  // Index minimal, à l'image de celui que renvoie l'API.
  const teams = new Map<string, string>([
    ["dallas mavericks", "DAL"], ["dallas", "DAL"], ["mavericks", "DAL"],
    ["oklahoma city thunder", "OKC"], ["oklahoma city", "OKC"], ["thunder", "OKC"],
    ["phoenix suns", "PHX"], ["phoenix", "PHX"], ["suns", "PHX"],
    ["charlotte hornets", "CHA"], ["charlotte", "CHA"], ["hornets", "CHA"],
    ["minnesota timberwolves", "MIN"], ["minnesota", "MIN"], ["timberwolves", "MIN"],
    ["brooklyn nets", "BKN"], ["brooklyn", "BKN"], ["nets", "BKN"],
  ]);

  check("découpage : deux mouvements dans une entrée", splitSentences("Signed F LeBron James to a contract. Waived F Dalen Terry."), ["Signed F LeBron James to a contract.", "Waived F Dalen Terry."]);
  check("découpage : un suffixe ne coupe pas la phrase", splitSentences("Signed F Larry Nance Jr. to a contract."), ["Signed F Larry Nance Jr. to a contract."]);
  check("découpage : trois mouvements", splitSentences("Acquired F Julius Randle from Minnesota. Waived G Malachi Smith. Signed F Joshua Jefferson to a rookie scale contract.").length, 3);

  check("position simple", playersInText("Signed F LeBron James to a contract."), ["LeBron James"]);
  check("position au pluriel, deux joueurs", playersInText("Acquired Gs LaMelo Ball and Josh Green from Charlotte"), ["LaMelo Ball", "Josh Green"]);
  check("initiales dans un nom", playersInText("Converted the contract of G A.J. Lawson to an NBA contract."), ["A.J. Lawson"]);
  // « AJ » et « CJ » ressemblent à des positions : la liste fermée les écarte.
  check("un prénom en initiales n'est pas une position", playersInText("Acquired G AJ Johnson and draft consideration from Dallas."), ["AJ Johnson"]);
  check("suffixe conservé", playersInText("Signed F Larry Nance Jr. to a contract."), ["Larry Nance Jr."]);

  check("prolongation annoncée", classifyEspn("Re-signed G De'Anthony Melton to a contract."), "extension");
  check("signature", classifyEspn("Signed F Moritz Wagner to a contract."), "signature");
  check("mise au ballottage est une coupe", classifyEspn("Placed G Miles Kelly on waivers."), "waiver");
  check("limogeage", classifyEspn("Fired head coach Jamahl Mosley."), "coaching");
  check("démission", classifyEspn("Announced the resignation of head coach Billy Donovan."), "coaching");
  check("échange", classifyEspn("Acquired C Nic Claxton from Brooklyn."), "trade");

  {
    const e = parseEspnSentence("Signed F LeBron James to a contract.", "2026-07-26", "PHI", teams)!;
    check("LeBron à Philadelphie", [e.kind, e.to_team, e.players.map((p) => p.name)], ["signature", "PHI", ["LeBron James"]]);
    check("rattaché à la saison qui s'ouvre", e.season, "2026-27");
  }
  {
    const e = parseEspnSentence("Re-signed G De'Anthony Melton to a contract.", "2026-07-31", "GSW", teams)!;
    check("prolongation : type et équipe", [e.kind, e.to_team], ["extension", "GSW"]);
    check("prolongation : phrase française", eventAction(e as unknown as MarketEvent), "prolonge De'Anthony Melton");
  }
  {
    // L'échange à trois qui envoie Risacher à Dallas.
    const e = parseEspnSentence(
      "Acquired G Ryan Nembhard from Dallas and G Luguentz Dort from Oklahoma City in a three-team trade that sent F Zaccharie Risacher to Dallas.",
      "2026-07-19",
      "ATL",
      teams
    )!;
    check("échange à trois : équipes", e.teams.sort(), ["ATL", "DAL", "OKC"]);
    check("échange à trois : joueurs reçus", e.players.filter((p) => p.to === "ATL").map((p) => p.name), ["Ryan Nembhard", "Luguentz Dort"]);
    check("échange à trois : Risacher part à Dallas", e.players.filter((p) => p.from === "ATL").map((p) => [p.name, p.to]), [["Zaccharie Risacher", "DAL"]]);
    check("échange à trois : origine de chaque arrivée", e.players.filter((p) => p.to === "ATL").map((p) => p.from), ["DAL", "OKC"]);
  }
  {
    const e = parseEspnSentence(
      "Acquired F Naz Reid and draft considerations from Minnesota Timberwolves for Gs LaMelo Ball and Josh Green.",
      "2026-07-15",
      "CHA",
      teams
    )!;
    check("échange classique : arrivée", e.players.filter((p) => p.to === "CHA").map((p) => p.name), ["Naz Reid"]);
    check("échange classique : départs", e.players.filter((p) => p.from === "CHA").map((p) => p.name), ["LaMelo Ball", "Josh Green"]);
    check("échange classique : choix reçu", e.assets.filter((a) => a.to === "CHA").length, 1);
  }
  {
    const e = parseEspnSentence("Fired head coach Jamahl Mosley.", "2026-04-20", "ORL", teams)!;
    check("encadrement : rôle et phrase", [e.kind, e.players[0].role, eventAction(e as unknown as MarketEvent)], ["coaching", "coach", "limoge son entraîneur principal Jamahl Mosley"]);
  }
  {
    const e = parseEspnSentence("Placed G Miles Kelly on waivers.", "2026-07-20", "DAL", teams)!;
    check("mise au ballottage : départ", [e.kind, e.from_team, e.players[0].name], ["waiver", "DAL", "Miles Kelly"]);
  }
  {
    // « Los Angeles » seul désigne deux franchises : ne rien affirmer.
    const ambiguous = new Map<string, string>([["los angeles lakers", "LAL"], ["lakers", "LAL"], ["los angeles clippers", "LAC"], ["clippers", "LAC"]]);
    check("ville ambiguë non résolue", teamInText("from Los Angeles", ambiguous), null);
    check("nom complet résolu", teamInText("from Los Angeles Lakers", ambiguous), "LAL");
  }
}

/* ── Dédoublonnage entre sources ── */
console.log("\n--- deux sources, un seul mouvement ---");
{
  const br = parseTransaction(
    `<p>The <a data-attr-to="PHI" href="/teams/PHI/2027.html">Philadelphia 76ers</a> signed <a href="/players/j/jamesle01.html">LeBron James</a>.</p>`,
    "2026-07-26"
  )!;
  const espn = parseEspnSentence("Signed F LeBron James to a contract.", "2026-07-26", "PHI", new Map())!;
  check("empreintes de texte différentes", br.event_key === espn.event_key, false);
  check("même sens reconnu", semanticKey(br) === semanticKey(espn), true);

  const autre = parseEspnSentence("Signed F Dalen Terry to a contract.", "2026-07-26", "PHI", new Map())!;
  check("deux joueurs distincts restent distincts", semanticKey(br) === semanticKey(autre), false);
}

/* ── Mouvements d'effectif ── */
console.log("\n--- arrivées, départs, prolongations ---");
{
  const event = (html: string, date: string) => parseTransaction(html, date)! as unknown as MarketEvent;

  const events = [
    // Une signature d'un joueur déjà présent la saison précédente : prolongation.
    event(`<p>The <a data-attr-to="TOR" href="/teams/TOR/2026.html">Toronto Raptors</a> signed <a href="/players/r/rhodeja01.html">Jared Rhoden</a>.</p>`, "2025-07-05"),
    // Une signature d'un joueur venu d'ailleurs : arrivée.
    event(SIGN, "2025-07-06"),
    // Un échange : départ d'un côté, arrivée de l'autre.
    event(TRADE, "2025-07-07"),
    // Une coupe : départ sec.
    event(WAIVE, "2025-10-18"),
    // Une conversion : le joueur reste.
    event(`<p>The <a data-attr-from="ATL" href="/teams/ATL/2026.html">Atlanta Hawks</a> converted <a href="/players/w/wallake01.html">Keaton Wallace</a> from a two-way contract to a regular contract.</p>`, "2025-11-02"),
    // Un aller en G League : ne change pas la composition de l'effectif.
    event(`<p>The <a data-attr-from="BOS" href="/teams/BOS/2026.html">Boston Celtics</a> assigned <a href="/players/w/walshjo01.html">Jordan Walsh</a> to the Maine Red Claws of the G-League.</p>`, "2025-12-01"),
    // Une suspension non plus.
    event(SUSPENSION, "2026-01-12"),
  ];

  // Rhoden était à Toronto la saison passée, personne d'autre.
  const wasThere = (player: { name: string }, team: string) => player.name === "Jared Rhoden" && team === "TOR";
  const rows = rosterMoves(events, wasThere);
  const of = (team: string) => rows.find((r) => r.team === team);

  check("prolongation reconnue", of("TOR")?.extensions.map((p) => p.name), ["Jared Rhoden"]);
  check("le prolongé n'est pas une arrivée", of("TOR")?.arrivals.length, 0);
  check("mais la coupe reste un départ", of("TOR")?.departures.map((p) => p.name), ["Jared Rhoden"]);
  check("signature d'un joueur venu d'ailleurs = arrivée", of("MIN")?.arrivals.map((p) => p.name), ["Jules Bernard"]);
  check("échange : arrivée chez le destinataire", of("MEM")?.arrivals.map((p) => p.name).sort(), ["Jahmai Mashack", "Justinian Jessup"]);
  check("échange : départ chez l'expéditeur", of("GSW")?.departures.map((p) => p.name).sort(), ["Jahmai Mashack", "Justinian Jessup"]);
  check("échange : contrepartie reçue", of("GSW")?.arrivals.map((p) => p.name), ["Will Richard"]);
  check("conversion = prolongation", of("ATL")?.extensions.map((p) => p.name), ["Keaton Wallace"]);
  check("G League hors du tableau", of("BOS"), undefined);
  check("suspension hors du tableau", rows.some((r) => r.arrivals.concat(r.departures, r.extensions).some((p) => p.name === "Rudy Gobert")), false);
  check("équipes triées par activité", rows[0].total >= rows[rows.length - 1].total, true);

  // Sans effectif précédent, aucune prolongation ne peut être affirmée.
  const blind = rosterMoves(events, () => false);
  check("sans effectif précédent, pas de prolongation inventée", blind.find((r) => r.team === "TOR")?.extensions.map((p) => p.name), []);

  // Les contrats de second plan sont identifiés pour être mis en retrait.
  const bernard = of("MIN")!.arrivals[0];
  check("un two-way est un mouvement de second plan", isMinorMove(bernard), true);
  const richard = of("GSW")!.arrivals[0];
  check("une arrivée par échange ne l'est pas", isMinorMove(richard), false);
  check(
    "une signature sans précision de contrat non plus",
    isMinorMove({ name: "X", player_id: null, date: "2025-07-01", kind: "signature", counterpart: null, contract: null }),
    false
  );
  check(
    "un contrat jusqu'à la fin de saison reste un vrai mouvement",
    isMinorMove({ name: "X", player_id: null, date: "2025-07-01", kind: "signature", counterpart: null, contract: { type: "rest_of_season", detail: null } }),
    false
  );
}

/* ── Université ou club d'un joueur drafté ── */
console.log("\n--- université ou club ---");
{
  // Les noms de franchises viennent de la base ; ici, un échantillon suffit.
  const franchises = new Set(["washington wizards", "wizards", "boston celtics", "celtics"]);
  check("la page de draft prime quand elle renseigne", resolveCollege("Duke", "Duke University", franchises), "Duke");
  check("le club de la fiche complète une case vide", resolveCollege(null, "JL Bourg-en-Bresse", franchises), "JL Bourg-en-Bresse");
  check("une équipe NBA n'est pas un club formateur", resolveCollege(null, "Washington Wizards", franchises), null);
  check("un surnom d'équipe NBA non plus", resolveCollege(null, "Wizards", franchises), null);
  check("rien d'un côté comme de l'autre", resolveCollege(null, null, franchises), null);
  check("casse et espaces indifférents", resolveCollege(null, "  washington   WIZARDS ", franchises), null);
  // L'API NBA écrit « - » quand elle ne sait pas : un tiret recopié se lirait
  // comme une information.
  check("un tiret n'est pas un club", resolveCollege(null, "-", franchises), null);
  check("ni un N/A", resolveCollege(null, "N/A", franchises), null);
  check("un tiret côté draft n'écrase pas la fiche", resolveCollege("-", "Cholet", franchises), "Cholet");
  check("les espaces autour sont retirés", resolveCollege(null, "  Le Mans Sarthe  ", franchises), "Le Mans Sarthe");
}

/* ── Loterie ── */
console.log("\n--- loterie ---");
check("odds plates depuis 2019", [lotteryOdds(2025, 1), lotteryOdds(2025, 3), lotteryOdds(2025, 14)], [14, 14, 0.5]);
check("ancienne grille avant 2019", [lotteryOdds(2018, 1), lotteryOdds(2018, 2)], [25, 19.9]);
check("hors loterie", lotteryOdds(2025, 15), null);
{
  const standings = [
    { team_tricode: "WAS", wins: 18, losses: 64 },
    { team_tricode: "UTA", wins: 17, losses: 65 },
    { team_tricode: "CHA", wins: 19, losses: 63 },
    { team_tricode: "BOS", wins: 61, losses: 21 },
    { team_tricode: "NYK", wins: 51, losses: 31 },
  ];
  const board = buildLotteryBoard({
    fromSeason: "2024-25",
    draftYear: 2025,
    standings,
    playoffTeams: new Set(["BOS", "NYK"]),
  });
  check("loterie : seules les non qualifiées", board.map((r) => r.team_tricode), ["UTA", "WAS", "CHA"]);
  check("loterie : rang du pire bilan", [board[0].pre_lottery_rank, board[0].odds_top1], [1, 14]);
  check("loterie : sans playoffs connus, pas de grille", buildLotteryBoard({ fromSeason: "2024-25", draftYear: 2025, standings, playoffTeams: new Set() }), []);
}

/* ── Pages réelles, si des saisons sont passées en argument ── */
const seasons = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}$/.test(a));

async function live() {
  for (const season of seasons) {
    console.log(`\n--- Basketball Reference : ${season} ---`);
    const { events, pagesRead, missing } = await fetchSeasonTransactions(season, (m) => console.log(`   ${m}`));
    const ofSeason = events.filter((e) => e.season === season);
    console.log(`   ${pagesRead.length} page(s) lue(s), ${missing.length} absente(s)`);
    console.log(`   ${events.length} mouvements au total, ${ofSeason.length} rattachés à ${season}`);

    const byKind = new Map<string, number>();
    for (const e of ofSeason) byKind.set(e.kind, (byKind.get(e.kind) || 0) + 1);
    console.log(
      "   " +
        [...byKind.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${KIND_LABELS[k as keyof typeof KIND_LABELS]} ${n}`)
          .join(" · ")
    );

    check(`${season} : des mouvements trouvés`, ofSeason.length > 50, true);
    check(`${season} : chaque mouvement a une date`, ofSeason.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.event_date)), true);
    check(`${season} : chaque mouvement a un texte brut`, ofSeason.every((e) => e.raw.length > 5), true);
    check(`${season} : empreintes uniques`, new Set(ofSeason.map((e) => e.event_key)).size, ofSeason.length);

    const major = ofSeason.filter((e) => !MINOR_KINDS.includes(e.kind));
    const withPlayer = major.filter((e) => e.players.length > 0);
    const ratio = major.length ? withPlayer.length / major.length : 0;
    console.log(`   joueur identifié sur ${(ratio * 100).toFixed(1)} % des mouvements majeurs`);
    check(`${season} : au moins 90 % des mouvements majeurs citent un joueur`, ratio > 0.9, true);

    const trades = ofSeason.filter((e) => e.kind === "trade");
    const directed = trades.filter((e) => e.players.some((p) => p.from) || e.assets.some((a) => a.from));
    console.log(`   ${trades.length} échanges, dont ${directed.length} avec un sens de circulation`);
    check(`${season} : la plupart des échanges ont un sens`, trades.length === 0 || directed.length / trades.length > 0.8, true);

    const phases = estimateSeasonPhases(season);
    const placed = ofSeason.filter((e) => phaseForDate(e.event_date, phases) !== null);
    console.log(`   ${((placed.length / ofSeason.length) * 100).toFixed(1)} % des mouvements tombent dans une période connue`);

    const others = ofSeason.filter((e) => e.kind === "other");
    if (others.length > 0) {
      console.log(`   ${others.length} mouvement(s) non classés, échantillon :`);
      for (const e of others.slice(0, 5)) console.log(`      ${e.event_date} ${e.raw.slice(0, 110)}`);
    }

    console.log("   trois échanges rendus en français :");
    for (const e of trades.slice(0, 3)) {
      console.log(`      ${e.from_team} — ${eventAction(e as unknown as MarketEvent).slice(0, 150)}`);
    }

    const year = seasonStartYear(season);
    const picks = await fetchDraft(year);
    console.log(`   draft ${year} : ${picks.length} choix`);
    check(`draft ${year} : des choix lus`, picks.length > 30, true);
    check(`draft ${year} : rangs uniques`, new Set(picks.map((p) => p.pick_overall)).size, picks.length);
    check(`draft ${year} : deux tours`, [...new Set(picks.map((p) => p.round))].sort(), [1, 2]);
    check(`draft ${year} : chaque choix a une équipe`, picks.every((p) => /^[A-Z]{3}$/.test(p.team_tricode)), true);
    const unused = picks.filter((p) => !p.player_name);
    console.log(`      ${picks.length - unused.length} choix exercés, ${unused.length} non exercé(s)`);
    if (picks[0]) {
      console.log(`      1er choix : ${picks[0].team_tricode} — ${picks[0].player_name} (${picks[0].college ?? "sans université"})`);
    }
  }
}

(seasons.length > 0 ? live() : Promise.resolve()).then(() => {
  console.log(`\n${pass} réussis, ${fail} échoués`);
  process.exit(fail > 0 ? 1 : 0);
});
