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
  e("1 — 8 289 pts", "lebron james", "lebron", "james", "lbj"),
  e("2 — 5 987 pts", "michael jordan", "jordan", "mj"),
  e("3 — 5 762 pts", "kareem abdul-jabbar", "kareem", "abdul-jabbar", "kareem abdul jabbar", "jabbar"),
  e("4 — 5 640 pts", "kobe bryant", "kobe", "bryant"),
  e("5 — 5 250 pts", "shaquille o'neal", "shaq", "shaquille", "o'neal", "oneal"),
  e("6 — 5 172 pts", "tim duncan", "duncan"),
  e("7 — 4 985 pts", "kevin durant", "durant", "kd"),
  e("8 — 4 761 pts", "karl malone", "malone"),
  e("9 — 4 457 pts", "jerry west", "west"),
  e("10 — 4 147 pts", "stephen curry", "curry", "steph", "steph curry"),
  e("11 — 4 045 pts", "tony parker", "parker"),
  e("12 — 3 954 pts", "dwyane wade", "wade", "dwyane", "dwayne wade"),
  e("13 — 3 897 pts", "larry bird", "bird"),
  e("14 — 3 895 pts", "james harden", "harden"),
  e("15 — 3 776 pts", "john havlicek", "havlicek"),
  e("16 — 3 755 pts", "hakeem olajuwon", "olajuwon", "hakeem", "olajuwan"),
  e("17 — 3 701 pts", "magic johnson", "magic", "johnson"),
  e("18 — 3 663 pts", "dirk nowitzki", "nowitzki", "dirk"),
  e("19 — 3 642 pts", "scottie pippen", "pippen", "scottie"),
  e("20 — 3 623 pts", "elgin baylor", "baylor"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("Top 20 marqueurs en playoffs All-Time")}&select=id`,
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
