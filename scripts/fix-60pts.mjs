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
  e("100 pts — 1962 vs Knicks", "wilt chamberlain", "chamberlain", "wilt"),
  e("83 pts — 2026 vs Wizards", "bam adebayo", "adebayo", "bam"),
  e("81 pts — 2006 vs Raptors", "kobe bryant", "kobe", "bryant"),
  e("73 pts — 1978 vs Pistons", "david thompson", "thompson"),
  e("73 pts — 2024 vs Hawks", "luka doncic", "doncic", "luka", "luka dončić"),
  e("71 pts — 1960 vs Knicks", "elgin baylor", "baylor"),
  e("71 pts — 1994 vs Clippers", "david robinson", "robinson"),
  e("71 pts — 2023 vs Bulls", "donovan mitchell", "mitchell", "spida"),
  e("71 pts — 2023 vs Rockets", "damian lillard", "lillard", "dame"),
  e("70 pts — 2017 vs Celtics", "devin booker", "booker", "book"),
  e("70 pts — 2024 vs Spurs", "joel embiid", "embiid", "joel"),
  e("69 pts — 1990 vs Cavaliers", "michael jordan", "jordan", "mj"),
  e("68 pts — 1977 vs Knicks", "pete maravich", "maravich", "pistol pete", "pistol"),
  e("64 pts — 1974 vs Trail Blazers", "rick barry", "barry"),
  e("64 pts — 2023 vs Pacers", "giannis antetokounmpo", "giannis", "antetokounmpo", "antetokumpo", "antetokoumpo"),
  e("63 pts — 1949 vs Jets", "joe fulks", "fulks"),
  e("63 pts — 1978 vs Jazz", "george gervin", "gervin", "iceman"),
  e("62 pts — 2004 vs Wizards", "tracy mcgrady", "mcgrady", "t-mac", "tmac"),
  e("62 pts — 2014 vs Bobcats", "carmelo anthony", "carmelo", "anthony", "melo"),
  e("62 pts — 2021 vs Trail Blazers", "stephen curry", "curry", "steph", "steph curry"),
  e("62 pts — 2024 vs Hornets", "karl-anthony towns", "towns", "kat", "karl anthony towns"),
  e("61 pts — 1952 vs Royals", "george mikan", "mikan"),
  e("61 pts — 2024 vs Spurs", "jalen brunson", "brunson", "jalen"),
  e("61 pts — 2025 vs Grizzlies", "nikola jokic", "jokic", "joker", "nikola jokić", "jokić"),
  e("60 pts — 1984 vs Nets", "bernard king", "king", "bernard"),
  e("60 pts — 1985 vs Hawks", "larry bird", "bird"),
  e("60 pts — 1990 vs Supersonics", "tom chambers", "chambers"),
  e("60 pts — 2005 vs Magic", "allen iverson", "iverson", "ai"),
  e("60 pts — 2006 vs Lakers", "gilbert arenas", "arenas", "agent zero"),
  e("60 pts — 2016 vs Pacers", "klay thompson", "thompson", "klay"),
  e("60 pts — 2018 vs Magic", "james harden", "harden"),
  e("60 pts — 2018 vs 76ers", "kemba walker", "walker", "kemba"),
  e("60 pts — 2021 vs 76ers", "bradley beal", "beal"),
  e("60 pts — 2021 vs Spurs", "jayson tatum", "tatum"),
  e("60 pts — 2022 vs Magic", "kyrie irving", "irving", "kyrie"),
  e("60 pts — 2024 vs Timberwolves", "de'aaron fox", "fox", "de'aaron", "deaaron fox"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("Joueurs ayant marqué 60+ points dans un match NBA")}&select=id`,
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
    body: JSON.stringify({ entries, time_limit: 480 }),
  }
);
console.log(res.ok ? `OK: ${entries.length} entries` : `FAIL: ${res.status} ${await res.text()}`);
