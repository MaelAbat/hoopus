/**
 * Seed 20 new Hoopiz quizzes into Supabase.
 * Usage: node scripts/seed-quizzes.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load env
const envPath = resolve(import.meta.dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

async function insertQuiz(quiz) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/quizzes`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      title: quiz.title,
      description: quiz.description,
      mode: quiz.mode,
      time_limit: quiz.time_limit,
      entries: quiz.entries,
      published: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`FAIL: ${quiz.title} — ${res.status} ${text}`);
  } else {
    console.log(`OK: ${quiz.title} (${quiz.entries.length} entries)`);
  }
}

// Helper: build entry
const e = (label, ...answers) => ({ label, answers });

// ════════════════════════════════════════════════════════════════
// QUIZ DATA
// ════════════════════════════════════════════════════════════════

const quizzes = [];

// ──────────────────────────────────────────────────────────────
// 1. N°1 de Draft NBA
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "N°1 de Draft depuis 1966",
  description: "Retrouve tous les premiers choix de Draft NBA, du plus récent au plus ancien.",
  mode: "ordered",
  time_limit: 720,
  entries: [
    e("2024 — Hawks", "zaccharie risacher", "risacher"),
    e("2023 — Spurs", "victor wembanyama", "wembanyama", "wemby", "wemba"),
    e("2022 — Magic", "paolo banchero", "banchero"),
    e("2021 — Pistons", "cade cunningham", "cunningham"),
    e("2020 — Timberwolves", "anthony edwards", "edwards", "ant", "ant man"),
    e("2019 — Pelicans", "zion williamson", "zion", "williamson"),
    e("2018 — Suns", "deandre ayton", "ayton"),
    e("2017 — 76ers", "markelle fultz", "fultz"),
    e("2016 — 76ers", "ben simmons", "simmons"),
    e("2015 — Timberwolves", "karl-anthony towns", "karl anthony towns", "towns", "kat"),
    e("2014 — Cavaliers", "andrew wiggins", "wiggins"),
    e("2013 — Cavaliers", "anthony bennett", "bennett"),
    e("2012 — Hornets", "anthony davis", "davis", "ad"),
    e("2011 — Cavaliers", "kyrie irving", "irving", "kyrie"),
    e("2010 — Wizards", "john wall", "wall"),
    e("2009 — Clippers", "blake griffin", "griffin"),
    e("2008 — Bulls", "derrick rose", "rose", "d-rose", "d rose"),
    e("2007 — Trail Blazers", "greg oden", "oden"),
    e("2006 — Raptors", "andrea bargnani", "bargnani"),
    e("2005 — Bucks", "andrew bogut", "bogut"),
    e("2004 — Magic", "dwight howard", "howard", "dwight"),
    e("2003 — Cavaliers", "lebron james", "lebron", "james", "lbj"),
    e("2002 — Rockets", "yao ming", "yao"),
    e("2001 — Wizards", "kwame brown", "brown", "kwame"),
    e("2000 — Nets", "kenyon martin", "martin", "kenyon"),
    e("1999 — Bulls", "elton brand", "brand"),
    e("1998 — Clippers", "michael olowokandi", "olowokandi"),
    e("1997 — Spurs", "tim duncan", "duncan"),
    e("1996 — 76ers", "allen iverson", "iverson", "ai"),
    e("1995 — Warriors", "joe smith", "smith"),
    e("1994 — Bucks", "glenn robinson", "robinson", "big dog"),
    e("1993 — Magic", "chris webber", "webber", "c-webb"),
    e("1992 — Magic", "shaquille o'neal", "shaquille oneal", "shaq", "o'neal", "oneal"),
    e("1991 — Hornets", "larry johnson", "johnson", "larry"),
    e("1990 — Nets", "derrick coleman", "coleman"),
    e("1989 — Kings", "pervis ellison", "ellison"),
    e("1988 — Clippers", "danny manning", "manning"),
    e("1987 — Spurs", "david robinson", "robinson"),
    e("1986 — Cavaliers", "brad daugherty", "daugherty"),
    e("1985 — Knicks", "patrick ewing", "ewing"),
    e("1984 — Rockets", "hakeem olajuwon", "olajuwon", "hakeem", "akeem", "olajuwan"),
    e("1983 — Rockets", "ralph sampson", "sampson"),
    e("1982 — Lakers", "james worthy", "worthy"),
    e("1981 — Mavericks", "mark aguirre", "aguirre"),
    e("1980 — Warriors", "joe barry carroll", "carroll", "joe barry"),
    e("1979 — Lakers", "magic johnson", "magic", "earvin johnson", "johnson"),
    e("1978 — Trail Blazers", "mychal thompson", "thompson", "mychal"),
    e("1977 — Bucks", "kent benson", "benson"),
    e("1976 — Rockets", "john lucas", "lucas"),
    e("1975 — Hawks", "david thompson", "thompson"),
    e("1974 — Trail Blazers", "bill walton", "walton"),
    e("1973 — 76ers", "doug collins", "collins"),
    e("1972 — Trail Blazers", "larue martin", "martin"),
    e("1971 — Cavaliers", "austin carr", "carr"),
    e("1970 — Pistons", "bob lanier", "lanier"),
    e("1969 — Bucks", "lew alcindor", "kareem abdul-jabbar", "kareem", "alcindor", "kareem abdul jabbar", "abdul-jabbar"),
    e("1968 — Rockets", "elvin hayes", "hayes"),
    e("1967 — Pistons", "jimmy walker", "walker"),
    e("1966 — Knicks", "cazzie russell", "russell"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 2. MVP du All-Star Game
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "MVP du All-Star Game depuis 1953",
  description: "Retrouve tous les MVP du NBA All-Star Game, du plus récent au premier.",
  mode: "ordered",
  time_limit: 720,
  entries: [
    e("2025", "victor wembanyama", "wembanyama", "wemby"),
    e("2024", "damian lillard", "lillard", "dame"),
    e("2023", "jayson tatum", "tatum"),
    e("2022", "stephen curry", "curry", "steph", "steph curry"),
    e("2021", "giannis antetokounmpo", "giannis", "antetokounmpo", "antetokumpo", "antetokoumpo"),
    e("2020", "kawhi leonard", "leonard", "kawhi"),
    e("2019", "kevin durant", "durant", "kd"),
    e("2018", "lebron james", "lebron", "james", "lbj"),
    e("2017", "anthony davis", "davis", "ad"),
    e("2016", "russell westbrook", "westbrook", "russ"),
    e("2015", "russell westbrook", "westbrook", "russ"),
    e("2014", "kyrie irving", "irving", "kyrie"),
    e("2013", "chris paul", "paul", "cp3"),
    e("2012", "kevin durant", "durant", "kd"),
    e("2011", "kobe bryant", "kobe", "bryant"),
    e("2010", "dwyane wade", "wade", "dwyane", "dwayne wade"),
    e("2009", "shaquille o'neal / kobe bryant", "shaquille o'neal", "shaq", "kobe bryant", "kobe", "shaq / kobe", "kobe / shaq"),
    e("2008", "lebron james", "lebron", "james", "lbj"),
    e("2007", "kobe bryant", "kobe", "bryant"),
    e("2006", "lebron james", "lebron", "james", "lbj"),
    e("2005", "allen iverson", "iverson", "ai"),
    e("2004", "shaquille o'neal", "shaq", "shaquille", "o'neal", "oneal"),
    e("2003", "kevin garnett", "garnett", "kg"),
    e("2002", "kobe bryant", "kobe", "bryant"),
    e("2001", "allen iverson", "iverson", "ai"),
    e("2000", "shaquille o'neal / tim duncan", "shaq", "shaquille o'neal", "tim duncan", "duncan", "shaq / duncan", "duncan / shaq"),
    e("1999 — Annulé (lockout)", "annule", "lockout", "pas de match", "aucun", "annulé", "-"),
    e("1998", "michael jordan", "jordan", "mj"),
    e("1997", "glen rice", "rice"),
    e("1996", "michael jordan", "jordan", "mj"),
    e("1995", "mitch richmond", "richmond"),
    e("1994", "scottie pippen", "pippen", "scottie"),
    e("1993", "karl malone / john stockton", "karl malone", "malone", "john stockton", "stockton", "malone / stockton", "stockton / malone"),
    e("1992", "magic johnson", "magic", "johnson"),
    e("1991", "charles barkley", "barkley", "chuck"),
    e("1990", "magic johnson", "magic", "johnson"),
    e("1989", "karl malone", "malone"),
    e("1988", "michael jordan", "jordan", "mj"),
    e("1987", "tom chambers", "chambers"),
    e("1986", "isiah thomas", "isiah", "thomas"),
    e("1985", "ralph sampson", "sampson"),
    e("1984", "isiah thomas", "isiah", "thomas"),
    e("1983", "julius erving", "erving", "dr j", "dr. j", "julius"),
    e("1982", "larry bird", "bird"),
    e("1981", "nate archibald", "archibald", "nate", "tiny archibald"),
    e("1980", "george gervin", "gervin", "iceman"),
    e("1979", "david thompson", "thompson"),
    e("1978", "randy smith", "smith"),
    e("1977", "julius erving", "erving", "dr j", "dr. j"),
    e("1976", "dave bing", "bing"),
    e("1975", "walt frazier", "frazier", "clyde"),
    e("1974", "bob lanier", "lanier"),
    e("1973", "dave cowens", "cowens"),
    e("1972", "jerry west", "west"),
    e("1971", "lenny wilkens", "wilkens"),
    e("1970", "willis reed", "reed"),
    e("1969", "oscar robertson", "robertson", "big o"),
    e("1968", "hal greer", "greer"),
    e("1967", "rick barry", "barry"),
    e("1966", "adrian smith", "smith"),
    e("1965", "jerry lucas", "lucas"),
    e("1964", "oscar robertson", "robertson", "big o"),
    e("1963", "bill russell", "russell"),
    e("1962", "bob pettit", "pettit"),
    e("1961", "oscar robertson", "robertson", "big o"),
    e("1960", "wilt chamberlain", "chamberlain", "wilt"),
    e("1959", "elgin baylor / bob pettit", "elgin baylor", "baylor", "bob pettit", "pettit"),
    e("1958", "bob pettit", "pettit"),
    e("1957", "bob cousy", "cousy"),
    e("1956", "bob pettit", "pettit"),
    e("1955", "bill sharman", "sharman"),
    e("1954", "bob cousy", "cousy"),
    e("1953", "george mikan", "mikan"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 3. Leader 3 points par saison
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Leader aux 3 points chaque saison NBA",
  description: "Retrouve le joueur ayant marqué le plus de 3 points chaque saison, depuis l'introduction du tir à 3 points en 1980.",
  mode: "ordered",
  time_limit: 600,
  entries: [
    e("2025 — 299", "stephen curry", "curry", "steph", "steph curry"),
    e("2024 — 321", "luka doncic", "doncic", "luka"),
    e("2023 — 273", "damian lillard", "lillard", "dame"),
    e("2022 — 285", "stephen curry", "curry", "steph", "steph curry"),
    e("2021 — 337", "stephen curry", "curry", "steph", "steph curry"),
    e("2020 — 270", "james harden", "harden"),
    e("2019 — 378", "james harden", "harden"),
    e("2018 — 265", "stephen curry", "curry", "steph", "steph curry"),
    e("2017 — 324", "stephen curry", "curry", "steph", "steph curry"),
    e("2016 — 402", "stephen curry", "curry", "steph", "steph curry"),
    e("2015 — 286", "stephen curry", "curry", "steph", "steph curry"),
    e("2014 — 240", "stephen curry", "curry", "steph", "steph curry"),
    e("2013 — 261", "stephen curry", "curry", "steph", "steph curry"),
    e("2012 — 166", "ryan anderson", "anderson"),
    e("2011 — 202", "ray allen", "allen", "ray"),
    e("2010 — 221", "ray allen", "allen", "ray"),
    e("2009 — 222", "rashard lewis", "lewis", "rashard"),
    e("2008 — 229", "jason richardson", "richardson"),
    e("2007 — 202", "gilbert arenas", "arenas"),
    e("2006 — 269", "ray allen", "allen", "ray"),
    e("2005 — 226", "quentin richardson", "richardson", "q-rich"),
    e("2004 — 205", "peja stojakovic", "stojakovic", "peja", "stojakovich"),
    e("2003 — 231", "ray allen", "allen", "ray"),
    e("2002 — 229", "ray allen", "allen", "ray"),
    e("2001 — 233", "antoine walker", "walker", "antoine"),
    e("2000 — 200", "gary payton", "payton"),
    e("1999 — 134", "dee brown", "brown"),
    e("1998 — 217", "wesley person", "person"),
    e("1997 — 267", "reggie miller", "miller", "reggie"),
    e("1996 — 231", "george mccloud", "mccloud"),
    e("1995 — 217", "john starks", "starks"),
    e("1994 — 192", "dan majerle", "majerle"),
    e("1993 — 167", "vernon maxwell", "maxwell"),
    e("1992 — 162", "dale ellis", "ellis"),
    e("1991 — 172", "vernon maxwell", "maxwell"),
    e("1990 — 166", "michael adams", "adams"),
    e("1989 — 166", "michael adams", "adams"),
    e("1988 — 148", "danny ainge", "ainge"),
    e("1987 — 151", "dale ellis", "ellis"),
    e("1986 — 106", "larry bird", "bird"),
    e("1985 — 92", "larry bird", "bird"),
    e("1984 — 73", "darrell griffith", "griffith"),
    e("1983 — 62", "mike dunleavy", "dunleavy"),
    e("1982 — 67", "don buse", "buse"),
    e("1981 — 57", "brian taylor", "taylor"),
    e("1980 — 44", "brian taylor", "taylor"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 4. Les 30 franchises NBA actuelles
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Les 30 franchises NBA actuelles",
  description: "Nomme les 30 équipes de la NBA. Tu peux donner le nom complet ou juste le surnom.",
  mode: "unordered",
  time_limit: 300,
  entries: [
    e("Est — Division Atlantique", "boston celtics", "celtics", "boston"),
    e("Est — Division Atlantique", "brooklyn nets", "nets", "brooklyn"),
    e("Est — Division Atlantique", "new york knicks", "knicks", "new york", "ny knicks"),
    e("Est — Division Atlantique", "philadelphia 76ers", "76ers", "sixers", "philadelphia", "philly"),
    e("Est — Division Atlantique", "toronto raptors", "raptors", "toronto"),
    e("Est — Division Centrale", "chicago bulls", "bulls", "chicago"),
    e("Est — Division Centrale", "cleveland cavaliers", "cavaliers", "cavs", "cleveland"),
    e("Est — Division Centrale", "detroit pistons", "pistons", "detroit"),
    e("Est — Division Centrale", "indiana pacers", "pacers", "indiana"),
    e("Est — Division Centrale", "milwaukee bucks", "bucks", "milwaukee"),
    e("Est — Division Sud-Est", "atlanta hawks", "hawks", "atlanta"),
    e("Est — Division Sud-Est", "charlotte hornets", "hornets", "charlotte"),
    e("Est — Division Sud-Est", "miami heat", "heat", "miami"),
    e("Est — Division Sud-Est", "orlando magic", "magic", "orlando"),
    e("Est — Division Sud-Est", "washington wizards", "wizards", "washington"),
    e("Ouest — Division Nord-Ouest", "denver nuggets", "nuggets", "denver"),
    e("Ouest — Division Nord-Ouest", "minnesota timberwolves", "timberwolves", "wolves", "minnesota", "t-wolves"),
    e("Ouest — Division Nord-Ouest", "oklahoma city thunder", "thunder", "okc", "oklahoma city", "oklahoma"),
    e("Ouest — Division Nord-Ouest", "portland trail blazers", "trail blazers", "blazers", "portland"),
    e("Ouest — Division Nord-Ouest", "utah jazz", "jazz", "utah"),
    e("Ouest — Division Pacifique", "golden state warriors", "warriors", "golden state", "gsw"),
    e("Ouest — Division Pacifique", "los angeles clippers", "clippers", "la clippers", "lac"),
    e("Ouest — Division Pacifique", "los angeles lakers", "lakers", "la lakers", "lal"),
    e("Ouest — Division Pacifique", "phoenix suns", "suns", "phoenix"),
    e("Ouest — Division Pacifique", "sacramento kings", "kings", "sacramento"),
    e("Ouest — Division Sud-Ouest", "dallas mavericks", "mavericks", "mavs", "dallas"),
    e("Ouest — Division Sud-Ouest", "houston rockets", "rockets", "houston"),
    e("Ouest — Division Sud-Ouest", "memphis grizzlies", "grizzlies", "memphis"),
    e("Ouest — Division Sud-Ouest", "new orleans pelicans", "pelicans", "new orleans", "nola"),
    e("Ouest — Division Sud-Ouest", "san antonio spurs", "spurs", "san antonio"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 5. Top 20 tireurs à 3 points All-Time
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Top 20 tireurs à 3 points All-Time",
  description: "Retrouve les 20 joueurs ayant marqué le plus de tirs à 3 points en carrière NBA.",
  mode: "unordered",
  time_limit: 300,
  entries: [
    e("1 — 3 747", "stephen curry", "curry", "steph", "steph curry"),
    e("2 — 2 973", "ray allen", "allen", "ray"),
    e("3 — 2 694", "james harden", "harden"),
    e("4 — 2 560", "reggie miller", "miller", "reggie"),
    e("5 — 2 497", "damian lillard", "lillard", "dame"),
    e("6 — 2 450", "kyle korver", "korver"),
    e("7 — 2 282", "vince carter", "carter", "vinsanity"),
    e("8 — 2 260", "jason terry", "terry", "jet"),
    e("9 — 2 217", "buddy hield", "hield", "buddy"),
    e("10 — 2 143", "paul george", "george", "pg", "pg13"),
    e("11 — 2 133", "lebron james", "lebron", "james", "lbj"),
    e("12 — 2 085", "jamal crawford", "crawford"),
    e("13 — 2 050", "klay thompson", "thompson", "klay"),
    e("14 — 1 978", "joe johnson", "johnson", "joe"),
    e("15 — 1 953", "j.r. smith", "jr smith", "j.r. smith", "smith"),
    e("16 — 1 913", "jason kidd", "kidd"),
    e("17 — 1 860", "kyle lowry", "lowry"),
    e("18 — 1 827", "paul pierce", "pierce", "the truth"),
    e("19 — 1 811", "cj mccollum", "mccollum", "cj"),
    e("20 — 1 791", "wesley matthews", "matthews"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 6. Joueurs français en NBA
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Joueurs français ayant joué en NBA",
  description: "Retrouve tous les joueurs français ayant participé à au moins un match NBA.",
  mode: "unordered",
  time_limit: 480,
  entries: [
    e("Spurs, Hornets (2001-2019)", "tony parker", "parker"),
    e("Spurs, Hawks, Bobcats, Suns (2003-2017)", "boris diaw", "diaw"),
    e("Blazers, Hornets, Clippers, 76ers (2008-...)", "nicolas batum", "batum"),
    e("Jazz, Wolves (2013-...)", "rudy gobert", "gobert"),
    e("Nuggets, Magic, Bucks, Pacers, Celtics, Knicks (2012-2024)", "evan fournier", "fournier"),
    e("Knicks, Mavs, Bulls, Pistons (2017-2023)", "frank ntilikina", "ntilikina", "ntilikiना", "franck ntilikina"),
    e("76ers, Nets, Hawks, Hornets, Bulls (2017-2022)", "timothe luwawu-cabarrot", "luwawu", "luwawu-cabarrot", "timothe luwawu", "cabarrot"),
    e("Pistons, Nets (2019-2021)", "sekou doumbouya", "doumbouya", "sekou"),
    e("Pistons, Nets (2020-2023)", "killian hayes", "hayes", "killian"),
    e("Spurs (2023-...)", "victor wembanyama", "wembanyama", "wemby", "wemba"),
    e("Hawks (2024-...)", "zaccharie risacher", "risacher"),
    e("Wizards (2024-...)", "alexandre sarr", "sarr"),
    e("Wizards (2024-...)", "bilal coulibaly", "coulibaly", "bilal"),
    e("Thunder (2022-...)", "ousmane dieng", "dieng", "ousmane"),
    e("Knicks (2024-...)", "pacome dadiet", "dadiet", "pacôme", "pacome"),
    e("Bulls, Knicks (2007-2020)", "joakim noah", "noah", "joakim"),
    e("Spurs, Mavs, Pacers, Wizards (2010-2019)", "ian mahinmi", "mahinmi"),
    e("Wizards, Pacers, Knicks (2010-2016)", "kevin seraphin", "seraphin", "séraphin"),
    e("Mavs, Rockets (2009-2014)", "rodrigue beaubois", "beaubois"),
    e("Warriors, Magic, Hawks, Suns, Celtics (2003-2013)", "mickael pietrus", "pietrus", "piétrus", "mickael pietrus"),
    e("Supersonics, Bucks, Clippers (2006-2011)", "mickael gelabale", "gelabale", "gélabale"),
    e("Nets, Nuggets (2005-2010)", "johan petro", "petro"),
    e("Nuggets, Thunder, Bulls, Bucks (2015-2020)", "joffrey lauvergne", "lauvergne"),
    e("Celtics, 76ers, Knicks (2017-2024)", "guerschon yabusele", "yabusele"),
    e("Suns, Nets (2018-2020)", "elie okobo", "okobo"),
    e("Celtics, 76ers (2019-2021)", "vincent poirier", "poirier"),
    e("Nuggets, Bucks (2018-2019)", "axel toupane", "toupane"),
    e("Raptors, Spurs (2013-2017)", "nando de colo", "de colo", "nando"),
    e("Trail Blazers, Knicks (2018-2021)", "jaylen hoard", "hoard"),
    e("Grizzlies, Nuggets, Kings, Mavs (2000-2008)", "tariq abdul-wahad", "abdul-wahad", "olivier saint-jean", "tariq", "saint-jean"),
    e("Warriors, Lakers, Bucks, Heat, Knicks (2005-2014)", "ronny turiaf", "turiaf"),
    e("Warriors, Cavaliers (2007-2009)", "mickael gelabale", "gelabale"),
    e("Bobcats, Warriors, Nuggets (2007-2009)", "alexis ajinca", "ajinca"),
    e("Pelicans, Mavs (2012-2018)", "alexis ajinca", "ajinca"),
  ],
});

// Remove duplicate Ajinca/Gelabale entries
quizzes[quizzes.length - 1].entries = quizzes[quizzes.length - 1].entries.filter((entry, i, arr) =>
  arr.findIndex(e2 => e2.answers[0] === entry.answers[0]) === i
);

// ──────────────────────────────────────────────────────────────
// 7. Joueurs ayant marqué 60+ points
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Joueurs ayant marqué 60+ points dans un match NBA",
  description: "Retrouve tous les joueurs ayant atteint ou dépassé les 60 points dans un match NBA de saison régulière.",
  mode: "unordered",
  time_limit: 360,
  entries: [
    e("100 pts — 1962 vs Knicks", "wilt chamberlain", "chamberlain", "wilt"),
    e("81 pts — 2006 vs Raptors", "kobe bryant", "kobe", "bryant"),
    e("73 pts — 2024 vs Hawks", "luka doncic", "doncic", "luka"),
    e("73 pts — 1978 vs Pistons", "david thompson", "thompson"),
    e("71 pts — 2024 vs Bulls", "donovan mitchell", "mitchell", "donovan", "spida"),
    e("71 pts — 2023 vs Rockets", "damian lillard", "lillard", "dame"),
    e("71 pts — 1994 vs Clippers", "david robinson", "robinson"),
    e("71 pts — 1960 vs Knicks", "elgin baylor", "baylor"),
    e("70 pts — 2024 vs Spurs", "joel embiid", "embiid", "joel"),
    e("70 pts — 2017 vs Celtics", "devin booker", "booker", "book"),
    e("69 pts — 1990 vs Cavaliers", "michael jordan", "jordan", "mj"),
    e("68 pts — 1977 vs Knicks", "pete maravich", "maravich", "pistol pete", "pistol"),
    e("64 pts — 1974 vs Trail Blazers", "rick barry", "barry"),
    e("63 pts — 1978 vs Bucks", "george gervin", "gervin", "iceman"),
    e("63 pts — 1962 vs Lakers", "jerry west", "west"),
    e("62 pts — 2004 vs Wizards", "tracy mcgrady", "mcgrady", "t-mac", "tmac"),
    e("62 pts — 2014 vs Bobcats", "carmelo anthony", "carmelo", "anthony", "melo"),
    e("61 pts — 2023 vs Spurs", "karl-anthony towns", "towns", "kat", "karl anthony towns"),
    e("61 pts — 1990 vs Bucks", "karl malone", "malone"),
    e("60 pts — 2023 vs Pacers", "kyrie irving", "irving", "kyrie"),
    e("60 pts — 2018 vs Magic", "james harden", "harden"),
    e("60 pts — 2018 vs 76ers", "kemba walker", "walker", "kemba"),
    e("60 pts — 2006 vs Lakers", "gilbert arenas", "arenas", "agent zero"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 8. Les 30 salles NBA actuelles
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Les 30 salles NBA actuelles",
  description: "Retrouve le nom de la salle de chaque franchise NBA.",
  mode: "unordered",
  time_limit: 420,
  entries: [
    e("Atlanta Hawks", "state farm arena", "state farm"),
    e("Boston Celtics", "td garden", "td"),
    e("Brooklyn Nets", "barclays center", "barclays"),
    e("Charlotte Hornets", "spectrum center", "spectrum"),
    e("Chicago Bulls", "united center", "united"),
    e("Cleveland Cavaliers", "rocket mortgage fieldhouse", "rocket mortgage"),
    e("Dallas Mavericks", "american airlines center", "american airlines", "aac"),
    e("Denver Nuggets", "ball arena", "ball"),
    e("Detroit Pistons", "little caesars arena", "little caesars"),
    e("Golden State Warriors", "chase center", "chase"),
    e("Houston Rockets", "toyota center", "toyota"),
    e("Indiana Pacers", "gainbridge fieldhouse", "gainbridge"),
    e("LA Clippers", "intuit dome", "intuit"),
    e("Los Angeles Lakers", "crypto.com arena", "crypto", "crypto.com", "staples center", "staples"),
    e("Memphis Grizzlies", "fedexforum", "fedex forum", "fedex"),
    e("Miami Heat", "kaseya center", "kaseya"),
    e("Milwaukee Bucks", "fiserv forum", "fiserv"),
    e("Minnesota Timberwolves", "target center", "target"),
    e("New Orleans Pelicans", "smoothie king center", "smoothie king"),
    e("New York Knicks", "madison square garden", "msg", "madison"),
    e("Oklahoma City Thunder", "paycom center", "paycom"),
    e("Orlando Magic", "kia center", "kia", "amway center"),
    e("Philadelphia 76ers", "wells fargo center", "wells fargo"),
    e("Phoenix Suns", "footprint center", "footprint"),
    e("Portland Trail Blazers", "moda center", "moda"),
    e("Sacramento Kings", "golden 1 center", "golden 1", "golden one"),
    e("San Antonio Spurs", "frost bank center", "frost bank"),
    e("Toronto Raptors", "scotiabank arena", "scotiabank"),
    e("Utah Jazz", "delta center", "delta"),
    e("Washington Wizards", "capital one arena", "capital one"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 9. Joueurs ayant joué 20+ saisons
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Joueurs ayant joué 20+ saisons en NBA",
  description: "Retrouve tous les joueurs ayant disputé au moins 20 saisons en carrière NBA.",
  mode: "unordered",
  time_limit: 360,
  entries: [
    e("22 saisons (1996-2019)", "vince carter", "carter", "vinsanity", "vince"),
    e("22 saisons (2003-...)", "lebron james", "lebron", "james", "lbj"),
    e("21 saisons (1969-1989)", "kareem abdul-jabbar", "kareem", "abdul-jabbar", "kareem abdul jabbar", "jabbar"),
    e("21 saisons (1986-2007)", "kevin garnett", "garnett", "kg"),
    e("21 saisons (1985-2003, 2004-2006)", "robert parish", "parish"),
    e("21 saisons (1997-2018)", "dirk nowitzki", "nowitzki", "dirk"),
    e("21 saisons (1984-2004)", "kevin willis", "willis"),
    e("20 saisons (1996-2016)", "kobe bryant", "kobe", "bryant"),
    e("20 saisons (1996-2016)", "tim duncan", "duncan"),
    e("20 saisons (1998-2018, 2019-...)", "jamal crawford", "crawford"),
    e("20 saisons (1984-2004)", "john stockton", "stockton"),
    e("20 saisons (1984-2003)", "karl malone", "malone"),
    e("20 saisons (1976-1997)", "moses malone", "malone", "moses"),
    e("20 saisons (2001-2020)", "jason terry", "terry", "jet"),
    e("20 saisons (2001-2020)", "udonis haslem", "haslem", "ud"),
    e("20 saisons (1999-2019)", "joe johnson", "johnson", "joe"),
    e("20 saisons (1997-2017)", "chauncey billups", "billups", "chauncey", "mr big shot"),
    e("20 saisons (2009-...)", "james harden", "harden"),
    e("20 saisons (1988-2008)", "reggie miller", "miller", "reggie"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 10. Villes ayant eu une franchise NBA
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Toutes les villes ayant eu une franchise NBA/BAA",
  description: "Retrouve toutes les villes ayant accueilli une franchise NBA ou BAA, y compris les franchises disparues.",
  mode: "unordered",
  time_limit: 480,
  entries: [
    e("Hawks (1968-...)", "atlanta"),
    e("Celtics (1946-...)", "boston"),
    e("Nets (2012-...)", "brooklyn"),
    e("Hornets (1988-2002, 2004-...)", "charlotte"),
    e("Bulls (1966-...)", "chicago"),
    e("Cavaliers (1970-...)", "cleveland"),
    e("Mavericks (1980-...)", "dallas"),
    e("Nuggets (1976-...)", "denver"),
    e("Pistons (1957-...)", "detroit"),
    e("Warriors (1962-1971, 2019-...)", "san francisco"),
    e("Warriors (1971-2019, ...)", "golden state"),
    e("Rockets (1971-...)", "houston"),
    e("Pacers (1976-...)", "indiana"),
    e("Clippers, Lakers (1984-...)", "los angeles"),
    e("Grizzlies (2001-...)", "memphis"),
    e("Heat (1988-...)", "miami"),
    e("Bucks (1968-...)", "milwaukee"),
    e("Timberwolves (1989-...)", "minnesota"),
    e("Nets (1977-2012)", "new jersey"),
    e("Pelicans, Hornets, Jazz (1974-...)", "new orleans"),
    e("Knicks, Nets (1946-...)", "new york"),
    e("Thunder (2008-...)", "oklahoma city"),
    e("Magic (1989-...)", "orlando"),
    e("76ers, Warriors (1946-1962)", "philadelphia"),
    e("Suns (1968-...)", "phoenix"),
    e("Trail Blazers (1970-...)", "portland"),
    e("Kings (1985-...)", "sacramento"),
    e("Spurs (1976-...)", "san antonio"),
    e("Supersonics (1967-2008)", "seattle"),
    e("Raptors (1995-...)", "toronto"),
    e("Jazz (1979-...)", "utah"),
    e("Grizzlies (1995-2001)", "vancouver"),
    e("Wizards, Bullets (1973-...)", "washington"),
    e("Royals (1957-1972)", "cincinnati"),
    e("Royals (1945-1957)", "rochester"),
    e("Hawks (1955-1968)", "st. louis", "saint louis", "st louis"),
    e("Nationals (1946-1963)", "syracuse"),
    e("Warriors (1946-1962)", "philadelphia"),
    e("Pistons (1948-1957)", "fort wayne"),
    e("Lakers (1947-1960)", "minneapolis"),
    e("Hawks (1949-1955)", "milwaukee"),
    e("Clippers (1978-1984)", "san diego"),
    e("Rockets (1967-1971)", "san diego"),
    e("Kings (1972-1985)", "kansas city"),
    e("Bullets (1963-1973)", "baltimore"),
    e("Packers/Zephyrs (1961-1963)", "chicago"),
    e("Capitols (1946-1951)", "washington"),
  ],
});
// Deduplicate by city
quizzes[quizzes.length - 1].entries = quizzes[quizzes.length - 1].entries.filter((entry, i, arr) =>
  arr.findIndex(e2 => e2.answers[0] === entry.answers[0]) === i
);

// ──────────────────────────────────────────────────────────────
// 11. Joueurs avec 3+ titres
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Joueurs ayant remporté 3+ titres NBA",
  description: "Retrouve tous les joueurs ayant gagné au moins 3 bagues de champion NBA.",
  mode: "unordered",
  time_limit: 600,
  entries: [
    e("11 titres — Celtics", "bill russell", "russell"),
    e("6 titres — Celtics", "sam jones", "jones"),
    e("8 titres — Celtics", "tom heinsohn", "heinsohn"),
    e("7 titres — Celtics", "k.c. jones", "kc jones", "k.c. jones"),
    e("8 titres — Celtics", "john havlicek", "havlicek"),
    e("6 titres — Celtics", "bob cousy", "cousy"),
    e("6 titres — Bulls", "michael jordan", "jordan", "mj"),
    e("6 titres — Bulls", "scottie pippen", "pippen", "scottie"),
    e("5 titres — Lakers, Celtics", "kareem abdul-jabbar", "kareem", "abdul-jabbar", "kareem abdul jabbar"),
    e("5 titres — Lakers", "magic johnson", "magic", "johnson"),
    e("5 titres — Lakers", "kobe bryant", "kobe", "bryant"),
    e("5 titres — Spurs", "tim duncan", "duncan"),
    e("5 titres — Spurs", "manu ginobili", "ginobili", "manu"),
    e("5 titres — Spurs, Raptors", "tony parker", "parker"),
    e("6 titres — Bulls", "dennis rodman", "rodman"),
    e("4 titres — Lakers, Heat", "shaquille o'neal", "shaq", "shaquille", "o'neal", "oneal"),
    e("4 titres — Lakers, Heat", "lebron james", "lebron", "james", "lbj"),
    e("4 titres — Warriors", "stephen curry", "curry", "steph"),
    e("4 titres — Warriors", "klay thompson", "thompson", "klay"),
    e("4 titres — Warriors, Cavaliers", "andre iguodala", "iguodala"),
    e("4 titres — Warriors", "draymond green", "green", "draymond"),
    e("4 titres — Spurs", "robert horry", "horry", "big shot rob"),
    e("3 titres — Lakers, Heat", "dwyane wade", "wade", "dwyane", "dwayne wade"),
    e("3 titres — Celtics", "larry bird", "bird"),
    e("3 titres — Lakers", "jerry west", "west"),
    e("3 titres — Pistons", "isiah thomas", "isiah", "thomas"),
    e("3 titres — Pistons", "joe dumars", "dumars"),
    e("3 titres — Bulls, Lakers", "horace grant", "grant", "horace"),
    e("3 titres — Rockets, Lakers", "rick fox", "fox"),
    e("3 titres — Rockets, Lakers", "derek fisher", "fisher"),
    e("3 titres — Lakers", "james worthy", "worthy"),
    e("3 titres — Celtics", "kevin mchale", "mchale"),
    e("3 titres — Celtics, Heat", "ray allen", "allen", "ray"),
    e("3 titres — Bulls", "ron harper", "harper"),
    e("3 titres — Heat, Cavaliers", "chris bosh", "bosh"),
    e("4 titres — Celtics", "frank ramsey", "ramsey"),
    e("7 titres — Lakers, Bulls, Spurs", "robert horry", "horry", "big shot rob"),
  ],
});
// Deduplicate
quizzes[quizzes.length - 1].entries = quizzes[quizzes.length - 1].entries.filter((entry, i, arr) =>
  arr.findIndex(e2 => e2.answers[0] === entry.answers[0]) === i
);

// ──────────────────────────────────────────────────────────────
// 12. Franchises sans titre
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Franchises NBA n'ayant jamais gagné de titre",
  description: "Nomme toutes les franchises NBA actuelles qui n'ont jamais remporté le titre de champion.",
  mode: "unordered",
  time_limit: 180,
  entries: [
    e("Conférence Est", "brooklyn nets", "nets", "brooklyn"),
    e("Conférence Est", "charlotte hornets", "hornets", "charlotte"),
    e("Conférence Est", "indiana pacers", "pacers", "indiana"),
    e("Conférence Est", "orlando magic", "magic", "orlando"),
    e("Conférence Ouest", "la clippers", "clippers", "los angeles clippers"),
    e("Conférence Ouest", "memphis grizzlies", "grizzlies", "memphis"),
    e("Conférence Ouest", "minnesota timberwolves", "timberwolves", "wolves", "minnesota"),
    e("Conférence Ouest", "new orleans pelicans", "pelicans", "new orleans"),
    e("Conférence Ouest", "phoenix suns", "suns", "phoenix"),
    e("Conférence Ouest", "utah jazz", "jazz", "utah"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 13. Top 20 marqueurs en playoffs All-Time
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Top 20 marqueurs en playoffs All-Time",
  description: "Retrouve les 20 meilleurs marqueurs de l'histoire des playoffs NBA.",
  mode: "unordered",
  time_limit: 360,
  entries: [
    e("1 — 8 162 pts", "lebron james", "lebron", "james", "lbj"),
    e("2 — 5 987 pts", "michael jordan", "jordan", "mj"),
    e("3 — 5 762 pts", "kareem abdul-jabbar", "kareem", "abdul-jabbar", "kareem abdul jabbar"),
    e("4 — 5 640 pts", "kobe bryant", "kobe", "bryant"),
    e("5 — 5 557 pts", "shaquille o'neal", "shaq", "shaquille", "o'neal", "oneal"),
    e("6 — 5 250 pts", "kevin durant", "durant", "kd"),
    e("7 — 5 172 pts", "tim duncan", "duncan"),
    e("8 — 4 761 pts", "karl malone", "malone"),
    e("9 — 4 457 pts", "jerry west", "west"),
    e("10 — 4 165 pts", "larry bird", "bird"),
    e("11 — 3 954 pts", "john havlicek", "havlicek"),
    e("12 — 3 897 pts", "stephen curry", "curry", "steph"),
    e("13 — 3 808 pts", "hakeem olajuwon", "olajuwon", "hakeem", "olajuwan"),
    e("14 — 3 701 pts", "magic johnson", "magic", "johnson"),
    e("15 — 3 642 pts", "james harden", "harden"),
    e("16 — 3 640 pts", "scottie pippen", "pippen", "scottie"),
    e("17 — 3 607 pts", "tony parker", "parker"),
    e("18 — 3 600 pts", "dwyane wade", "wade", "dwyane", "dwayne wade"),
    e("19 — 3 500 pts", "elgin baylor", "baylor"),
    e("20 — 3 468 pts", "giannis antetokounmpo", "giannis", "antetokounmpo", "antetokumpo"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 14. Quadruple-doubles
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Joueurs ayant réalisé un quadruple-double en NBA",
  description: "Retrouve tous les joueurs ayant enregistré au moins 10 dans 4 catégories statistiques lors d'un match NBA.",
  mode: "unordered",
  time_limit: 120,
  entries: [
    e("1974 — 22pts/14reb/13ast/12blk vs Hawks", "nate thurmond", "thurmond"),
    e("1986 — 20pts/11reb/10ast/10stl vs Suns", "alvin robertson", "robertson"),
    e("1990 — 18pts/16reb/10ast/11blk vs Bucks", "hakeem olajuwon", "olajuwon", "hakeem", "olajuwan"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 15. Top 30 matchs joués All-Time
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Top 30 matchs joués All-Time NBA",
  description: "Retrouve les 30 joueurs ayant disputé le plus de matchs en carrière NBA.",
  mode: "unordered",
  time_limit: 480,
  entries: [
    e("1 — 1 611 matchs", "robert parish", "parish"),
    e("2 — 1 560 matchs", "kareem abdul-jabbar", "kareem", "abdul-jabbar", "kareem abdul jabbar"),
    e("3 — 1 541 matchs", "vince carter", "carter", "vinsanity"),
    e("4 — 1 522 matchs", "dirk nowitzki", "nowitzki", "dirk"),
    e("5 — 1 504 matchs", "john stockton", "stockton"),
    e("6 — 1 487 matchs", "karl malone", "malone"),
    e("7 — 1 476 matchs", "kevin garnett", "garnett", "kg"),
    e("8 — 1 462 matchs", "lebron james", "lebron", "james", "lbj"),
    e("9 — 1 424 matchs", "reggie miller", "miller", "reggie"),
    e("10 — 1 421 matchs", "kevin willis", "willis"),
    e("11 — 1 391 matchs", "jason terry", "terry", "jet"),
    e("12 — 1 380 matchs", "tim duncan", "duncan"),
    e("13 — 1 363 matchs", "kobe bryant", "kobe", "bryant"),
    e("14 — 1 346 matchs", "paul pierce", "pierce", "the truth"),
    e("15 — 1 340 matchs", "jamal crawford", "crawford"),
    e("16 — 1 329 matchs", "moses malone", "malone", "moses"),
    e("17 — 1 307 matchs", "joe johnson", "johnson", "joe"),
    e("18 — 1 303 matchs", "udonis haslem", "haslem", "ud"),
    e("19 — 1 300 matchs", "andre miller", "miller", "andre"),
    e("20 — 1 296 matchs", "elvin hayes", "hayes"),
    e("21 — 1 287 matchs", "gary payton", "payton", "the glove"),
    e("22 — 1 270 matchs", "dale ellis", "ellis"),
    e("23 — 1 265 matchs", "tony parker", "parker"),
    e("24 — 1 260 matchs", "tree rollins", "rollins"),
    e("25 — 1 254 matchs", "mark jackson", "jackson"),
    e("26 — 1 247 matchs", "al horford", "horford"),
    e("27 — 1 238 matchs", "buck williams", "williams", "buck"),
    e("28 — 1 234 matchs", "cliff robinson", "robinson", "cliff"),
    e("29 — 1 231 matchs", "jason kidd", "kidd"),
    e("30 — 1 225 matchs", "kyle lowry", "lowry"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 16. Top 20 coaches les plus victorieux
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Top 20 coaches NBA les plus victorieux",
  description: "Retrouve les 20 coaches ayant remporté le plus de matchs en saison régulière NBA.",
  mode: "unordered",
  time_limit: 360,
  entries: [
    e("1 — 1 412 victoires", "don nelson", "nelson"),
    e("2 — 1 335 victoires", "lenny wilkens", "wilkens"),
    e("3 — 1 326 victoires", "gregg popovich", "popovich", "pop"),
    e("4 — 1 210 victoires", "jerry sloan", "sloan"),
    e("5 — 1 175 victoires", "pat riley", "riley"),
    e("6 — 1 132 victoires", "george karl", "karl"),
    e("7 — 1 098 victoires", "phil jackson", "jackson", "phil"),
    e("8 — 1 063 victoires", "rick adelman", "adelman"),
    e("9 — 1 042 victoires", "larry brown", "brown"),
    e("10 — 1 025 victoires", "erik spoelstra", "spoelstra", "spo"),
    e("11 — 978 victoires", "doc rivers", "rivers", "doc"),
    e("12 — 953 victoires", "nate mcmillan", "mcmillan"),
    e("13 — 944 victoires", "red auerbach", "auerbach", "red"),
    e("14 — 935 victoires", "mike d'antoni", "d'antoni", "d antoni", "dantoni"),
    e("15 — 914 victoires", "jack ramsay", "ramsay"),
    e("16 — 893 victoires", "cotton fitzsimmons", "fitzsimmons"),
    e("17 — 864 victoires", "steve kerr", "kerr"),
    e("18 — 842 victoires", "gene shue", "shue"),
    e("19 — 838 victoires", "mike budenholzer", "budenholzer", "bud"),
    e("20 — 823 victoires", "bill fitch", "fitch"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 17. Numéros retirés par les Celtics
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Numéros retirés par les Boston Celtics",
  description: "Retrouve tous les joueurs dont le numéro a été retiré par les Boston Celtics.",
  mode: "unordered",
  time_limit: 360,
  entries: [
    e("N°1", "walter brown", "brown"),
    e("N°2", "red auerbach", "auerbach", "red"),
    e("N°3", "dennis johnson", "johnson", "dj"),
    e("N°5", "kevin garnett", "garnett", "kg"),
    e("N°6", "bill russell", "russell"),
    e("N°10", "jo jo white", "white", "jo jo"),
    e("N°14", "bob cousy", "cousy"),
    e("N°15", "tom heinsohn", "heinsohn"),
    e("N°16", "tom sanders", "sanders", "satch"),
    e("N°17", "john havlicek", "havlicek"),
    e("N°18", "dave cowens", "cowens"),
    e("N°19", "don nelson", "nelson"),
    e("N°21", "bill sharman", "sharman"),
    e("N°22", "ed macauley", "macauley"),
    e("N°23", "frank ramsey", "ramsey"),
    e("N°24", "sam jones", "jones"),
    e("N°25", "k.c. jones", "kc jones", "k.c. jones"),
    e("N°31", "cedric maxwell", "maxwell"),
    e("N°32", "kevin mchale", "mchale"),
    e("N°33", "larry bird", "bird"),
    e("N°34", "paul pierce", "pierce", "the truth"),
    e("N°35", "reggie lewis", "lewis"),
    e("LOSCY", "jim loscutoff", "loscutoff"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 18. Numéros retirés par les Lakers
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Numéros retirés par les Los Angeles Lakers",
  description: "Retrouve tous les joueurs dont le numéro a été retiré par les Lakers.",
  mode: "unordered",
  time_limit: 300,
  entries: [
    e("N°8 et N°24", "kobe bryant", "kobe", "bryant"),
    e("N°13", "wilt chamberlain", "chamberlain", "wilt"),
    e("N°22", "elgin baylor", "baylor"),
    e("N°25", "gail goodrich", "goodrich"),
    e("N°32", "magic johnson", "magic", "johnson"),
    e("N°33", "kareem abdul-jabbar", "kareem", "abdul-jabbar", "kareem abdul jabbar"),
    e("N°34", "shaquille o'neal", "shaq", "shaquille", "o'neal", "oneal"),
    e("N°42", "james worthy", "worthy"),
    e("N°44", "jerry west", "west"),
    e("N°52", "jamaal wilkes", "wilkes"),
    e("Micro", "chick hearn", "hearn"),
    e("N°99", "george mikan", "mikan"),
    e("N°16", "pau gasol", "gasol", "pau"),
  ],
});

// ──────────────────────────────────────────────────────────────
// 19. Joueurs 50+ points en playoffs
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Joueurs ayant marqué 50+ points en playoffs NBA",
  description: "Retrouve tous les joueurs ayant atteint ou dépassé les 50 points dans un match de playoffs NBA.",
  mode: "unordered",
  time_limit: 360,
  entries: [
    e("63 pts — 1986 vs Celtics", "michael jordan", "jordan", "mj"),
    e("56 pts — 1986 vs Cavaliers", "charles barkley", "barkley", "chuck"),
    e("56 pts — 1988 vs Cavaliers", "michael jordan", "jordan", "mj"),
    e("55 pts — 1969 vs Lakers", "jerry west", "west"),
    e("55 pts — 2024 vs Timberwolves", "anthony edwards", "edwards", "ant"),
    e("54 pts — 2019 vs Trail Blazers", "damian lillard", "lillard", "dame"),
    e("53 pts — 2018 vs Cavaliers", "donovan mitchell", "mitchell", "spida"),
    e("50 pts — 2023 vs Grizzlies", "anthony edwards", "edwards", "ant"),
    e("50 pts — 2023 vs Celtics", "jayson tatum", "tatum"),
    e("50 pts — 2020 vs Jazz", "jamal murray", "murray", "jamal"),
    e("50 pts — 2020 vs Clippers", "jamal murray", "murray", "jamal"),
    e("50 pts — 2019 vs Clippers", "kevin durant", "durant", "kd"),
    e("50 pts — 1970 vs Lakers", "jerry west", "west"),
    e("50 pts — 2021 vs Nets", "giannis antetokounmpo", "giannis", "antetokounmpo", "antetokumpo"),
    e("50 pts — 2006 vs Suns", "kobe bryant", "kobe", "bryant"),
    e("50 pts — 1962 vs Lakers", "wilt chamberlain", "chamberlain", "wilt"),
    e("50 pts — 1986 vs Hawks", "dominique wilkins", "wilkins", "nique"),
    e("50 pts — 2003 vs Pacers", "allen iverson", "iverson", "ai"),
    e("51 pts — 2023 vs Sixers", "jayson tatum", "tatum"),
    e("50 pts — 2009 vs Bulls", "lebron james", "lebron", "james", "lbj"),
  ],
});
// Deduplicate by player
quizzes[quizzes.length - 1].entries = quizzes[quizzes.length - 1].entries.filter((entry, i, arr) =>
  arr.findIndex(e2 => e2.answers[0] === entry.answers[0]) === i
);

// ──────────────────────────────────────────────────────────────
// 20. Top 25 triple-doubles
// ──────────────────────────────────────────────────────────────
quizzes.push({
  title: "Top 25 triple-doubles en carrière NBA",
  description: "Retrouve les 25 joueurs ayant enregistré le plus de triple-doubles en saison régulière NBA.",
  mode: "unordered",
  time_limit: 360,
  entries: [
    e("1 — 199+", "russell westbrook", "westbrook", "russ"),
    e("2 — 135+", "oscar robertson", "robertson", "big o"),
    e("3 — 120+", "magic johnson", "magic", "johnson"),
    e("4 — 115+", "jason kidd", "kidd"),
    e("5 — 112+", "lebron james", "lebron", "james", "lbj"),
    e("6 — 107+", "nikola jokic", "jokic", "joker"),
    e("7 — 107+", "luka doncic", "doncic", "luka"),
    e("8 — 78", "wilt chamberlain", "chamberlain", "wilt"),
    e("9 — 68", "james harden", "harden"),
    e("10 — 59", "larry bird", "bird"),
    e("11 — 56", "domantas sabonis", "sabonis"),
    e("12 — 51", "fat lever", "lever", "fat"),
    e("13 — 46", "grant hill", "hill", "grant"),
    e("14 — 46", "bob cousy", "cousy"),
    e("15 — 44", "rajon rondo", "rondo"),
    e("16 — 44", "john havlicek", "havlicek"),
    e("17 — 43", "ben simmons", "simmons"),
    e("18 — 42", "john wall", "wall"),
    e("19 — 41", "giannis antetokounmpo", "giannis", "antetokounmpo", "antetokumpo"),
    e("20 — 40", "mark jackson", "jackson"),
    e("21 — 38", "lafayette lever", "lever"),
    e("22 — 37", "clyde drexler", "drexler", "clyde"),
    e("23 — 36", "trae young", "trae", "young"),
    e("24 — 35", "chris paul", "paul", "cp3"),
    e("25 — 33", "jimmy butler", "butler", "jimmy"),
  ],
});
// Remove the duplicate Fat Lever/Lafayette Lever
quizzes[quizzes.length - 1].entries = quizzes[quizzes.length - 1].entries.filter((entry, i, arr) =>
  arr.findIndex(e2 => e2.answers[0] === entry.answers[0]) === i
);

// ════════════════════════════════════════════════════════════════
// INSERT ALL
// ════════════════════════════════════════════════════════════════
console.log(`Inserting ${quizzes.length} quizzes...\n`);
for (const quiz of quizzes) {
  await insertQuiz(quiz);
}
console.log("\nDone!");
