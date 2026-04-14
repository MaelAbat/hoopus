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
  e("23 saisons (2003-...)", "lebron james", "lebron", "james", "lbj"),
  e("22 saisons (1996-2020)", "vince carter", "carter", "vinsanity", "vince"),
  e("21 saisons (1969-1989)", "kareem abdul-jabbar", "kareem", "abdul-jabbar", "kareem abdul jabbar", "jabbar"),
  e("21 saisons (1976-1997)", "robert parish", "parish"),
  e("21 saisons (1984-2007)", "kevin willis", "willis"),
  e("21 saisons (1995-2016)", "kevin garnett", "garnett", "kg"),
  e("21 saisons (1998-2019)", "dirk nowitzki", "nowitzki", "dirk"),
  e("21 saisons (2005-...)", "chris paul", "paul", "cp3"),
  e("20 saisons (1996-2016)", "kobe bryant", "kobe", "bryant"),
  e("20 saisons (2000-2020)", "jamal crawford", "crawford"),
  e("20 saisons (2003-2023)", "udonis haslem", "haslem", "ud"),
  e("20 saisons (2006-...)", "kyle lowry", "lowry"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("Joueurs ayant joué 20+ saisons en NBA")}&select=id`,
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
