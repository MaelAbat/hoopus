import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const e = (label, ...answers) => ({ label, answers });

const entries = [
  e("Kings, Magic, Nuggets, Mavs", "tariq abdul-wahad", "abdul-wahad", "tariq", "olivier saint-jean", "saint-jean"),
  e("Bobcats, Mavs, Raptors, Pelicans", "alexis ajinca", "ajinca", "ajinça"),
  e("Wizards", "joel ayayi", "ayayi", "joël ayayi"),
  e("Blazers, Hornets, Clippers, 76ers", "nicolas batum", "batum"),
  e("Mavericks", "rodrigue beaubois", "beaubois"),
  e("Timberwolves", "joan beringer", "beringer"),
  e("Nuggets, Mavericks", "howard carter", "carter"),
  e("Pistons", "malcolm cazalon", "cazalon"),
  e("Spurs, Blazers", "sidy cissoko", "cissoko"),
  e("Nuggets", "petr cornelie", "cornelie"),
  e("Wizards", "bilal coulibaly", "coulibaly", "bilal"),
  e("Knicks", "pacome dadiet", "dadiet", "pacôme dadiet"),
  e("Spurs, Raptors", "nando de colo", "de colo", "nando"),
  e("Clippers, Hornets", "moussa diabate", "diabate", "diabaté"),
  e("Hawks, Suns, Bobcats, Spurs, Jazz", "boris diaw", "diaw"),
  e("Knicks", "mohamed diawara", "diawara", "mohamed"),
  e("Nuggets, Heat", "yakhouba diawara", "diawara", "yakhouba"),
  e("Thunder", "ousmane dieng", "dieng", "ousmane"),
  e("Pistons, Lakers", "sekou doumbouya", "doumbouya", "sekou"),
  e("Bulls", "noa essengue", "essengue"),
  e("Nuggets, Magic, Celtics, Knicks, Pistons", "evan fournier", "fournier"),
  e("Supersonics, Timberwolves", "mickael gelabale", "gelabale", "gélabale"),
  e("Jazz, Timberwolves", "rudy gobert", "gobert"),
  e("Pistons, Nets", "killian hayes", "hayes", "killian"),
  e("Blazers, Thunder", "jaylen hoard", "hoard"),
  e("Rockets", "william howard", "howard", "william"),
  e("Bucks", "damien inglis", "inglis"),
  e("Nuggets, Thunder, Bulls, Spurs", "joffrey lauvergne", "lauvergne"),
  e("76ers, Thunder, Bulls, Nets, Hawks", "timothe luwawu-cabarrot", "luwawu", "luwawu-cabarrot", "timothe luwawu", "cabarrot"),
  e("Spurs, Mavs, Pacers, Wizards", "ian mahinmi", "mahinmi"),
  e("Thunder, Hornets, Suns", "theo maledon", "maledon", "théo maledon"),
  e("Celtics, Hornets, Raptors, Nets, Cavaliers", "jerome moiso", "moiso", "moïso", "jérôme moiso"),
  e("Bulls", "adam mokoka", "mokoka"),
  e("Bulls, Knicks, Grizzlies, Clippers", "joakim noah", "noah", "joakim"),
  e("Knicks, Mavs, Hornets", "frank ntilikina", "ntilikina"),
  e("Suns", "elie okobo", "okobo"),
  e("Spurs, Hornets", "tony parker", "parker"),
  e("Magic", "noah penda", "penda"),
  e("Supersonics, Thunder, Nuggets, Nets, Hawks", "johan petro", "petro"),
  e("Warriors, Magic, Suns, Celtics, Raptors", "mickael pietrus", "pietrus", "piétrus"),
  e("Celtics, 76ers", "vincent poirier", "poirier"),
  e("Grizzlies", "yves pons", "pons"),
  e("Kings", "maxime raynaud", "raynaud"),
  e("Mavericks", "antoine rigaudeau", "rigaudeau"),
  e("Hawks", "bob riley", "riley"),
  e("Hawks", "zaccharie risacher", "risacher"),
  e("Trail Blazers", "rayan rupert", "rupert"),
  e("Hornets", "tidjane salaun", "salaun", "salaün"),
  e("Wizards", "alexandre sarr", "sarr", "alexandre"),
  e("Thunder", "olivier sarr", "sarr", "olivier sarr"),
  e("Wizards, Knicks, Pacers", "kevin seraphin", "seraphin", "séraphin"),
  e("Hawks", "pape sy", "sy"),
  e("Grizzlies", "killian tillie", "tillie"),
  e("Nuggets, Bucks, Pelicans", "axel toupane", "toupane"),
  e("Lakers", "armel traore", "traore", "traoré"),
  e("Nets", "nolan traore", "traore", "nolan traoré"),
  e("Lakers, Warriors, Knicks, Wizards, Heat, Clippers, Wolves", "ronny turiaf", "turiaf"),
  e("Spurs", "victor wembanyama", "wembanyama", "wemby", "wemba"),
  e("Celtics, 76ers, Knicks", "guerschon yabusele", "yabusele"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("Joueurs français ayant joué en NBA")}&select=id`,
  { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
);
const [quiz] = await listRes.json();

const res = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?id=eq.${quiz.id}`,
  {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ entries, time_limit: 600 }),
  }
);
console.log(res.ok ? `OK: ${entries.length} entries` : `FAIL: ${res.status} ${await res.text()}`);
