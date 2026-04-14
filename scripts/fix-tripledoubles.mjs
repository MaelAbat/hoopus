import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const entries = [
  {label:"1 — 209",answers:["russell westbrook","westbrook","russ"]},
  {label:"2 — 198",answers:["nikola jokic","jokic","joker","nikola jokić","jokić"]},
  {label:"3 — 181",answers:["oscar robertson","robertson","big o"]},
  {label:"4 — 138",answers:["magic johnson","magic","johnson","earvin johnson"]},
  {label:"5 — 125",answers:["lebron james","lebron","james","lbj"]},
  {label:"6 — 107",answers:["jason kidd","kidd"]},
  {label:"7 — 90",answers:["luka doncic","doncic","luka","luka dončić","dončić"]},
  {label:"8 — 82",answers:["james harden","harden"]},
  {label:"9 — 78",answers:["wilt chamberlain","chamberlain","wilt"]},
  {label:"10 — 68",answers:["domantas sabonis","sabonis"]},
  {label:"11 — 59",answers:["larry bird","bird"]},
  {label:"12 — 56",answers:["giannis antetokounmpo","giannis","antetokounmpo","antetokumpo","antetokoumpo"]},
  {label:"13 — 43",answers:["fat lever","lever"]},
  {label:"14 — 33",answers:["bob cousy","cousy"]},
  {label:"14 — 33",answers:["ben simmons","simmons"]},
  {label:"14 — 33",answers:["draymond green","green","draymond"]},
  {label:"17 — 32",answers:["rajon rondo","rondo"]},
  {label:"18 — 31",answers:["josh giddey","giddey"]},
  {label:"18 — 31",answers:["john havlicek","havlicek"]},
  {label:"20 — 29",answers:["grant hill","hill","grant"]},
];

const res = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?id=eq.67122d36-f5d4-4948-8dcb-36b6fdd10c26`,
  {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ entries, title: "Top 20 triple-doubles en carrière NBA" }),
  }
);
console.log(res.ok ? "OK" : `FAIL: ${res.status} ${await res.text()}`);
