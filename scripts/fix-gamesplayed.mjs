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
  e("1 — 1 615 matchs", "lebron james", "lebron", "james", "lbj"),
  e("2 — 1 611 matchs", "robert parish", "parish"),
  e("3 — 1 560 matchs", "kareem abdul-jabbar", "kareem", "abdul-jabbar", "kareem abdul jabbar", "jabbar"),
  e("4 — 1 541 matchs", "vince carter", "carter", "vinsanity", "vince"),
  e("5 — 1 522 matchs", "dirk nowitzki", "nowitzki", "dirk"),
  e("6 — 1 504 matchs", "john stockton", "stockton"),
  e("7 — 1 476 matchs", "karl malone", "malone"),
  e("8 — 1 462 matchs", "kevin garnett", "garnett", "kg"),
  e("9 — 1 424 matchs", "kevin willis", "willis"),
  e("10 — 1 410 matchs", "jason terry", "terry", "jet"),
  e("11 — 1 392 matchs", "tim duncan", "duncan"),
  e("12 — 1 391 matchs", "jason kidd", "kidd"),
  e("13 — 1 389 matchs", "reggie miller", "miller", "reggie"),
  e("14 — 1 380 matchs", "clifford robinson", "robinson", "cliff"),
  e("15 — 1 370 matchs", "chris paul", "paul", "cp3"),
  e("16 — 1 346 matchs", "kobe bryant", "kobe", "bryant"),
  e("17 — 1 343 matchs", "paul pierce", "pierce", "the truth"),
  e("18 — 1 335 matchs", "gary payton", "payton", "the glove"),
  e("19 — 1 329 matchs", "moses malone", "malone", "moses"),
  e("20 — 1 327 matchs", "jamal crawford", "crawford"),
  e("21 — 1 307 matchs", "buck williams", "williams", "buck"),
  e("22 — 1 304 matchs", "andre miller", "miller", "andre"),
  e("23 — 1 303 matchs", "elvin hayes", "hayes"),
  e("24 — 1 301 matchs", "russell westbrook", "westbrook", "russ"),
  e("25 — 1 300 matchs", "ray allen", "allen", "ray"),
  e("26 — 1 296 matchs", "mark jackson", "jackson"),
  e("27 — 1 287 matchs", "derek fisher", "fisher"),
  e("28 — 1 286 matchs", "sam perkins", "perkins"),
  e("29 — 1 282 matchs", "charles oakley", "oakley"),
  e("30 — 1 278 matchs", "a.c. green", "ac green", "a.c. green", "green"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("Top 30 matchs joués All-Time NBA")}&select=id`,
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
