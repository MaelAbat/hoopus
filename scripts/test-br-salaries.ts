/**
 * Vérifie la récupération des salaires contre Basketball Reference en direct.
 *
 * Deux régimes doivent fonctionner : une saison jouée (page de saison) et la
 * saison à venir (page de contrats). Et une saison passée ne doit JAMAIS se
 * faire servir la colonne y1 d'une autre saison — c'est le bug d'origine.
 *
 * Test réseau : il interroge le vrai site, donc il est lent et dépend de la
 * disponibilité de BR. À lancer à la main, pas dans une boucle serrée.
 */
import {
  fetchTeamSalaries,
  normalizeName,
  parseSalaryRows,
  readContractsSeason,
} from "../src/lib/br-salaries";

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`)
  );
  ok ? pass++ : fail++;
}

function report(label: string, condition: boolean, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  condition ? pass++ : fail++;
}

/* ── Parsing pur, sans réseau ── */
console.log("--- normalisation ---");
check("suffixe Jr. retiré", normalizeName("Kevin Porter Jr."), "kevin porter");
check("suffixe III retiré", normalizeName("Jimmy Butler III"), "jimmy butler");
check("accents retirés", normalizeName("Nikola Jokić"), "nikola jokic");
check("espaces normalisés", normalizeName("  Al   Horford "), "al horford");

console.log("\n--- parsing de lignes ---");
{
  // Forme d'une page de saison : nom en <td>, salaire en data-stat="salary".
  const seasonRow =
    '<tr ><th scope="row" data-stat="ranker" csk="1" >1</th>' +
    '<td class="left " data-append-csv="antetgi01" data-stat="player" >' +
    '<a href="/players/a/antetgi01.html">Giannis Antetokounmpo</a></td>' +
    '<td class="right " data-stat="salary" csk="54126450" >$54,126,450</td></tr>';
  const parsed = parseSalaryRows(seasonRow, "salary");
  check("page de saison", [...parsed.entries()], [["giannis antetokounmpo", "$54,126,450"]]);
}
{
  // Forme d'une page de contrats : nom en <th>, salaire en data-stat="y1".
  const contractRow =
    '<tr ><th scope="row" class="left " data-stat="player" csk="herroty01" >' +
    "<a href='/players/h/herroty01.html'>Tyler Herro</a></th>" +
    '<td class="center " data-stat="age_today" >26</td>' +
    '<td class="right " data-stat="y1" csk="33000000" >$33,000,000</td></tr>';
  const parsed = parseSalaryRows(contractRow, "y1");
  check("page de contrats", [...parsed.entries()], [["tyler herro", "$33,000,000"]]);
}
{
  // L'en-tête de colonne ne doit pas être pris pour un joueur.
  const header =
    '<tr><th aria-label="Rk" data-stat="ranker" >Rk</th>' +
    '<th aria-label="&nbsp;" data-stat="player" scope="col" >&nbsp;</th>' +
    '<th aria-label="Salary" data-stat="salary" scope="col" >Salary</th></tr>';
  check("en-tête ignoré", parseSalaryRows(header, "salary").size, 0);
}
{
  const dup =
    '<tr><td data-stat="player" >Al Horford</td><td data-stat="salary" >$6,822,000</td></tr>' +
    '<tr><td data-stat="player" >Al Horford</td><td data-stat="salary" >$6,822,000</td></tr>';
  check("tableau répété dédoublonné", parseSalaryRows(dup, "salary").size, 1);
}
check(
  "en-tête de contrats lu",
  readContractsSeason('<th aria-label="2026-27" data-stat="y1" scope="col" >2026-27</th>'),
  "2026-27"
);
check("en-tête absent", readContractsSeason("<th data-stat=\"y2\" >2027-28</th>"), null);

/* ── Contre le vrai site ── */
async function main() {
  console.log("\n--- saison jouée : 2025-26 (page de saison attendue) ---");
  const played = await fetchTeamSalaries("MIL", "2025-26");
  report("MIL 2025-26 trouvé", !!played, played ? `${played.salaries.size} salaires` : "aucun");
  if (played) {
    check("  source", played.source, "season-page");
    report(
      "  Giannis à 54 126 450 $ (MIL 2025-26)",
      played.salaries.get("giannis antetokounmpo") === "$54,126,450",
      played.salaries.get("giannis antetokounmpo") ?? "absent"
    );
  }

  console.log("\n--- saison à venir : 2026-27 (page de contrats attendue) ---");
  const upcoming = await fetchTeamSalaries("MIA", "2026-27");
  report("MIA 2026-27 trouvé", !!upcoming, upcoming ? `${upcoming.salaries.size} salaires` : "aucun");
  if (upcoming) {
    check("  source", upcoming.source, "contracts");
    const giannis = upcoming.salaries.get("giannis antetokounmpo");
    report("  Giannis désormais chez MIA", !!giannis, giannis ?? "absent");
  }

  console.log("\n--- garde-fou : une saison ancienne ne doit rien recevoir de y1 ---");
  // 2019-20 : la page de saison existe, donc elle doit être utilisée.
  const old = await fetchTeamSalaries("MIL", "2019-20");
  report("MIL 2019-20 via page de saison", old?.source === "season-page", old?.source ?? "aucun");

  // 2030-31 : aucune page de saison, et /contracts/ n'annonce pas cette saison
  // — le résultat doit être nul, pas des montants d'une autre année.
  const future = await fetchTeamSalaries("MIL", "2030-31");
  report("2030-31 refusé plutôt que mal attribué", future === null, String(future));

  console.log(`\n${pass} réussis, ${fail} échoués`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("ECHEC:", e.message);
  process.exit(1);
});
