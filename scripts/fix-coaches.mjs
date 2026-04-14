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
  e("1 — 1 412 victoires", "gregg popovich", "popovich", "pop"),
  e("2 — 1 335 victoires", "don nelson", "nelson"),
  e("3 — 1 332 victoires", "lenny wilkens", "wilkens"),
  e("4 — 1 221 victoires", "jerry sloan", "sloan"),
  e("5 — 1 210 victoires", "pat riley", "riley"),
  e("6 — 1 194 victoires", "doc rivers", "rivers", "doc"),
  e("7 — 1 175 victoires", "george karl", "karl"),
  e("8 — 1 155 victoires", "phil jackson", "jackson", "phil"),
  e("9 — 1 098 victoires", "larry brown", "brown"),
  e("10 — 1 042 victoires", "rick adelman", "adelman"),
  e("11 — 1 012 victoires", "rick carlisle", "carlisle"),
  e("12 — 944 victoires", "bill fitch", "fitch"),
  e("13 — 938 victoires", "red auerbach", "auerbach", "red"),
  e("14 — 935 victoires", "dick motta", "motta"),
  e("15 — 864 victoires", "jack ramsay", "ramsay"),
  e("16 — 832 victoires", "cotton fitzsimmons", "fitzsimmons"),
  e("17 — 828 victoires", "erik spoelstra", "spoelstra", "spo"),
  e("18 — 784 victoires", "gene shue", "shue"),
  e("19 — 760 victoires", "nate mcmillan", "mcmillan"),
  e("20 — 707 victoires", "john macleod", "macleod"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("Top 20 coaches NBA les plus victorieux")}&select=id`,
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
