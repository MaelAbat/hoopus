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
  e("1 — 4 233", "stephen curry", "curry", "steph", "steph curry"),
  e("2 — 3 373", "james harden", "harden"),
  e("3 — 2 973", "ray allen", "allen", "ray"),
  e("4 — 2 886", "klay thompson", "thompson", "klay"),
  e("5 — 2 804", "damian lillard", "lillard", "dame"),
  e("6 — 2 627", "lebron james", "lebron", "james", "lbj"),
  e("7 — 2 560", "reggie miller", "miller", "reggie"),
  e("8 — 2 450", "kyle korver", "korver"),
  e("9 — 2 425", "paul george", "george", "pg", "pg13"),
  e("10 — 2 357", "kevin durant", "durant", "kd"),
  e("11 — 2 290", "vince carter", "carter", "vinsanity"),
  e("12 — 2 282", "jason terry", "terry", "jet"),
  e("13 — 2 221", "jamal crawford", "crawford"),
  e("14 — 2 208", "kyle lowry", "lowry"),
  e("15 — 2 194", "buddy hield", "hield", "buddy"),
  e("16 — 2 164", "cj mccollum", "mccollum", "cj"),
  e("17 — 2 143", "paul pierce", "pierce", "the truth"),
  e("18 — 2 092", "eric gordon", "gordon"),
  e("19 — 2 054", "tim hardaway jr", "hardaway", "tim hardaway jr.", "hardaway jr"),
  e("20 — 1 988", "jason kidd", "kidd"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("Top 20 tireurs à 3 points All-Time")}&select=id`,
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
