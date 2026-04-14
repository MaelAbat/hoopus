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
  e("63 pts — 1986 vs Celtics", "michael jordan", "jordan", "mj"),
  e("61 pts — 1962 vs Celtics", "elgin baylor", "baylor"),
  e("57 pts — 2020 vs Nuggets", "donovan mitchell", "mitchell", "spida"),
  e("56 pts — 1962 vs Nationals", "wilt chamberlain", "chamberlain", "wilt"),
  e("56 pts — 1994 vs Warriors", "charles barkley", "barkley", "chuck", "sir charles"),
  e("56 pts — 2023 vs Bucks", "jimmy butler", "butler", "jimmy"),
  e("55 pts — 1967 vs 76ers", "rick barry", "barry"),
  e("55 pts — 2003 vs Hornets", "allen iverson", "iverson", "ai"),
  e("55 pts — 2021 vs Nuggets", "damian lillard", "lillard", "dame"),
  e("54 pts — 1973 vs Hawks", "john havlicek", "havlicek"),
  e("53 pts — 1969 vs Celtics", "jerry west", "west"),
  e("53 pts — 2017 vs Wizards", "isaiah thomas", "thomas", "isaiah", "it"),
  e("53 pts — 2023 vs Suns", "nikola jokic", "jokic", "joker", "nikola jokić", "jokić"),
  e("51 pts — 1967 vs Knicks", "sam jones", "jones"),
  e("51 pts — 1987 vs Lakers", "eric floyd", "floyd", "sleepy floyd", "sleepy"),
  e("51 pts — 2009 vs Bulls", "ray allen", "allen", "ray"),
  e("51 pts — 2017 vs Rockets", "russell westbrook", "westbrook", "russ"),
  e("51 pts — 2018 vs Warriors", "lebron james", "lebron", "james", "lbj"),
  e("51 pts — 2023 vs 76ers", "jayson tatum", "tatum"),
  e("50 pts — 1953 vs Nationals", "bob cousy", "cousy"),
  e("50 pts — 1958 vs Celtics", "bob pettit", "pettit"),
  e("50 pts — 1970 vs Bucks", "billy cunningham", "cunningham"),
  e("50 pts — 1975 vs Bullets", "bob mcadoo", "mcadoo"),
  e("50 pts — 1986 vs Pistons", "dominique wilkins", "wilkins", "nique"),
  e("50 pts — 2000 vs Supersonics", "karl malone", "malone"),
  e("50 pts — 2001 vs 76ers", "vince carter", "carter", "vinsanity"),
  e("50 pts — 2006 vs Suns", "kobe bryant", "kobe", "bryant"),
  e("50 pts — 2006 vs Suns", "dirk nowitzki", "nowitzki", "dirk"),
  e("50 pts — 2019 vs Clippers", "kevin durant", "durant", "kd"),
  e("50 pts — 2020 vs Jazz", "jamal murray", "murray", "jamal"),
  e("50 pts — 2021 vs Suns", "giannis antetokounmpo", "giannis", "antetokounmpo", "antetokumpo", "antetokoumpo"),
  e("50 pts — 2023 vs Kings", "stephen curry", "curry", "steph", "steph curry"),
  e("50 pts — 2024 vs Knicks", "joel embiid", "embiid", "joel"),
];

// Find quiz
const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("Joueurs ayant marqué 50+ points en playoffs NBA")}&select=id`,
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
    body: JSON.stringify({ entries }),
  }
);
console.log(res.ok ? `OK: ${entries.length} entries` : `FAIL: ${res.status} ${await res.text()}`);
