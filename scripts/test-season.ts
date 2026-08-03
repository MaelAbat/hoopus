/**
 * Scénarios de bascule de saison.
 *
 * Le cas qui a motivé tout ceci : le 3 août 2026, la règle calendaire renvoyait
 * encore « 2025-26 » alors que les Finales étaient jouées depuis juin. Les
 * trades de l'intersaison atterrissaient donc dans la saison terminée.
 */
import {
  buildSeasonOptions,
  gameTypeFromGameId,
  isSeasonAfter,
  latestSeason,
  resolveLeagueSeason,
  seasonAfter,
  seasonBefore,
  seasonFromDate,
  seasonFromGameId,
  seasonFromStartYear,
  seasonStatus,
  seasonStatusLabel,
} from "../src/lib/season";
import {
  KNOWN_THRESHOLDS,
  projectThresholds,
  resolveThresholds,
} from "../src/lib/salary-cap";

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

console.log("--- libellés ---");
check("seasonFromStartYear(2025)", seasonFromStartYear(2025), "2025-26");
check("seasonFromStartYear(1999) — passage de siècle", seasonFromStartYear(1999), "1999-00");
check("seasonAfter(2025-26)", seasonAfter("2025-26"), "2026-27");
check("seasonBefore(2025-26)", seasonBefore("2025-26"), "2024-25");
check("seasonAfter(1999-00)", seasonAfter("1999-00"), "2000-01");
check("isSeasonAfter(2026-27, 2025-26)", isSeasonAfter("2026-27", "2025-26"), true);
check("isSeasonAfter(2025-26, 2025-26)", isSeasonAfter("2025-26", "2025-26"), false);
check("latestSeason ignore les vides", latestSeason(null, "2024-25", undefined, "2026-27", ""), "2026-27");
check("latestSeason sans candidat", latestSeason(null, undefined), null);

console.log("\n--- saison lue dans l'identifiant de match ---");
check("Finales 2025-26", seasonFromGameId("0042500407"), "2025-26");
check("saison régulière 2026-27", seasonFromGameId("0022600001"), "2026-27");
check("play-in 2025-26", seasonFromGameId("0052500101"), "2025-26");
check("présaison 2026-27", seasonFromGameId("0012600005"), "2026-27");
check("saison des années 1990", seasonFromGameId("0029600001"), "1996-97");
check("identifiant trop court", seasonFromGameId("00425004"), null);
check("identifiant non numérique", seasonFromGameId("00425A0407"), null);
check("type — playoffs", gameTypeFromGameId("0042500407"), "playoffs");
check("type — régulière", gameTypeFromGameId("0022600001"), "regular");
check("type — présaison", gameTypeFromGameId("0012600005"), "preseason");
check("type — inconnu", gameTypeFromGameId("0092600005"), null);

console.log("\n--- règle calendaire (le comportement fautif, conservé comme filet) ---");
check("3 août 2026 → saison terminée", seasonFromDate(new Date("2026-08-03T12:00:00Z")), "2025-26");
check("15 octobre 2026 → nouvelle saison", seasonFromDate(new Date("2026-10-15T12:00:00Z")), "2026-27");

console.log("\n--- résolution de la saison de ligue ---");

// Le cas réel : intersaison, Finales jouées, calendrier en retard.
check(
  "intersaison après les Finales → nouvelle saison",
  resolveLeagueSeason({
    calendarSeason: "2025-26",
    scheduleSeason: "2026-27",
    finalsCompletedSeason: "2025-26",
  }),
  "2026-27"
);

// Les Finales seules suffisent : le CDN peut être injoignable.
check(
  "Finales seules, CDN muet",
  resolveLeagueSeason({
    calendarSeason: "2025-26",
    scheduleSeason: null,
    finalsCompletedSeason: "2025-26",
  }),
  "2026-27"
);

// Le CDN seul suffit aussi : les playoffs peuvent ne pas être synchronisés.
check(
  "CDN seul, Finales inconnues",
  resolveLeagueSeason({
    calendarSeason: "2025-26",
    scheduleSeason: "2026-27",
    finalsCompletedSeason: null,
  }),
  "2026-27"
);

// En pleine saison, rien ne doit avancer.
check(
  "saison en cours, Finales de l'an dernier",
  resolveLeagueSeason({
    calendarSeason: "2026-27",
    scheduleSeason: "2026-27",
    finalsCompletedSeason: "2025-26",
  }),
  "2026-27"
);

// Aucun signal : on retombe sur le calendrier.
check(
  "aucun signal",
  resolveLeagueSeason({ calendarSeason: "2025-26" }),
  "2025-26"
);

// La saison ne recule jamais, même si un signal est en retard.
check(
  "signal en retard ignoré",
  resolveLeagueSeason({
    calendarSeason: "2026-27",
    scheduleSeason: "2024-25",
    finalsCompletedSeason: "2023-24",
  }),
  "2026-27"
);

// Borne de sécurité : un signal corrompu ne peut pas sauter plusieurs saisons.
check(
  "signal aberrant borné à une saison",
  resolveLeagueSeason({
    calendarSeason: "2025-26",
    scheduleSeason: "2031-32",
    finalsCompletedSeason: "2030-31",
  }),
  "2026-27"
);

console.log("\n--- statut d'une saison ---");

// Saison en cours : la ligue et les matchs joués sont sur la même saison. Ce
// bloc protège le comportement en pleine saison des ajouts d'intersaison.
{
  const inSeason = { currentSeason: "2026-27", statsSeason: "2026-27" };
  check("saison en cours", seasonStatus("2026-27", inSeason), "current");
  check("saison précédente terminée", seasonStatus("2025-26", inSeason), "completed");
  check("saison future à venir", seasonStatus("2027-28", inSeason), "upcoming");
}

// Intersaison : la ligue a basculé, aucun match joué.
{
  const offSeason = { currentSeason: "2026-27", statsSeason: "2025-26" };
  check("saison de ligue à venir", seasonStatus("2026-27", offSeason), "upcoming");
  check("saison écoulée terminée", seasonStatus("2025-26", offSeason), "completed");
  check("saison ancienne terminée", seasonStatus("2019-20", offSeason), "completed");
}

check("libellé à venir", seasonStatusLabel("upcoming"), "à venir");
check("libellé en cours", seasonStatusLabel("current"), "en cours");
check("libellé terminée", seasonStatusLabel("completed"), "terminée");

console.log("\n--- listes de saisons ---");
check(
  "tri décroissant et dédoublonnage",
  buildSeasonOptions(["2023-24", "2025-26", "2023-24"], "2026-27"),
  ["2026-27", "2025-26", "2023-24"]
);
check("valeurs vides ignorées", buildSeasonOptions(["2025-26", null, undefined, ""], null), [
  "2025-26",
]);
check(
  "saison de ligue ajoutée même sans données",
  buildSeasonOptions(["2025-26"], "2026-27").includes("2026-27"),
  true
);
check(
  "en pleine saison, aucune entrée superflue",
  buildSeasonOptions(["2026-27", "2025-26"], "2026-27"),
  ["2026-27", "2025-26"]
);
// Le premier élément est la saison la plus récente, qui n'est pas le défaut
// d'une page de statistiques à l'intersaison — d'où `defaultSeason` dans
// SeasonSelector, sans quoi choisir la saison à venir renverrait ailleurs.
check(
  "le plus récent n'est pas le défaut des stats",
  buildSeasonOptions(["2025-26", "2024-25"], "2026-27")[0],
  "2026-27"
);

console.log("\n--- seuils de masse salariale : aucune saison codée en dur ---");

// Une saison connue reste exacte.
{
  const t = resolveThresholds("2025-26");
  check("2025-26 exact", [t.salaryCap, t.isEstimated], [154_647_000, false]);
}

// La projection reproduit exactement la progression observée entre les deux
// saisons connues : elle est donc calibrée, pas inventée.
{
  const projected = projectThresholds(KNOWN_THRESHOLDS["2024-25"], 1);
  check("2024-25 projeté sur un an redonne 2025-26", projected, KNOWN_THRESHOLDS["2025-26"]);
}

// Les saisons que personne n'a saisies fonctionnent quand même — c'est tout
// l'enjeu : aucune modification de code à la bascule de saison.
for (const [season, years] of [
  ["2026-27", 1],
  ["2027-28", 2],
  ["2030-31", 5],
] as const) {
  const t = resolveThresholds(season);
  const expected = projectThresholds(KNOWN_THRESHOLDS["2025-26"], years);
  check(`${season} projeté`, [t.salaryCap, t.isEstimated], [expected.salaryCap, true]);
  check(`  ${season} — ordre des seuils respecté`,
    t.salaryCap < t.luxuryTax && t.luxuryTax < t.firstApron && t.firstApron < t.secondApron,
    true
  );
}

// Une saison antérieure à tout ce qu'on connaît ne doit pas renvoyer zéro.
{
  const t = resolveThresholds("2015-16");
  check("saison ancienne : montants non nuls", t.salaryCap > 0, true);
  check("  et marquée estimée", t.isEstimated, true);
}

// Un montant réel saisi en base l'emporte, et sert de base aux projections
// suivantes — c'est ce qui rend la correction annuelle purement déclarative.
{
  const known = {
    ...KNOWN_THRESHOLDS,
    "2026-27": {
      salaryCap: 160_000_000,
      luxuryTax: 194_000_000,
      firstApron: 202_000_000,
      secondApron: 214_000_000,
    },
  };
  check("montant saisi l'emporte", resolveThresholds("2026-27", known).salaryCap, 160_000_000);
  check("  et n'est plus estimé", resolveThresholds("2026-27", known).isEstimated, false);
  check(
    "  la saison suivante projette depuis lui",
    resolveThresholds("2027-28", known).salaryCap,
    projectThresholds(known["2026-27"], 1).salaryCap
  );
}

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail > 0 ? 1 : 0);
