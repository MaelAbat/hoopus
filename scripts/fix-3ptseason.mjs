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
  e("2025 — 320", "anthony edwards", "edwards", "ant", "ant man"),
  e("2024 — 357", "stephen curry", "curry", "steph", "steph curry"),
  e("2023 — 301", "klay thompson", "thompson", "klay"),
  e("2022 — 285", "stephen curry", "curry", "steph", "steph curry"),
  e("2021 — 337", "stephen curry", "curry", "steph", "steph curry"),
  e("2020 — 299", "james harden", "harden"),
  e("2019 — 378", "james harden", "harden"),
  e("2018 — 265", "james harden", "harden"),
  e("2017 — 324", "stephen curry", "curry", "steph", "steph curry"),
  e("2016 — 402", "stephen curry", "curry", "steph", "steph curry"),
  e("2015 — 286", "stephen curry", "curry", "steph", "steph curry"),
  e("2014 — 261", "stephen curry", "curry", "steph", "steph curry"),
  e("2013 — 272", "stephen curry", "curry", "steph", "steph curry"),
  e("2012 — 166", "ryan anderson", "anderson"),
  e("2011 — 194", "dorell wright", "wright", "dorell"),
  e("2010 — 209", "aaron brooks", "brooks", "aaron"),
  e("2009 — 220", "rashard lewis", "lewis", "rashard"),
  e("2008 — 243", "jason richardson", "richardson"),
  e("2007 — 205", "raja bell", "bell", "raja"),
  e("2006 — 269", "ray allen", "allen", "ray"),
  e("2005 — 226", "kyle korver", "korver"),
  e("2004 — 240", "peja stojakovic", "stojakovic", "peja", "stojakovich", "stojaković"),
  e("2003 — 201", "ray allen", "allen", "ray"),
  e("2002 — 229", "ray allen", "allen", "ray"),
  e("2001 — 221", "antoine walker", "walker", "antoine"),
  e("2000 — 177", "gary payton", "payton"),
  e("1999 — 135", "dee brown", "brown"),
  e("1998 — 192", "wesley person", "person"),
  e("1997 — 229", "reggie miller", "miller", "reggie"),
  e("1996 — 267", "dennis scott", "scott", "dennis"),
  e("1995 — 217", "john starks", "starks"),
  e("1994 — 192", "dan majerle", "majerle"),
  e("1993 — 167", "dan majerle", "majerle"),
  e("1992 — 162", "vernon maxwell", "maxwell"),
  e("1991 — 172", "vernon maxwell", "maxwell"),
  e("1990 — 158", "michael adams", "adams"),
  e("1989 — 166", "michael adams", "adams"),
  e("1988 — 148", "danny ainge", "ainge"),
  e("1987 — 90", "larry bird", "bird"),
  e("1986 — 82", "larry bird", "bird"),
  e("1985 — 92", "darrell griffith", "griffith"),
  e("1984 — 91", "darrell griffith", "griffith"),
  e("1983 — 67", "mike dunleavy", "dunleavy"),
  e("1982 — 78", "don buse", "buse"),
  e("1981 — 57", "mike bratz", "bratz"),
  e("1980 — 90", "brian taylor", "taylor"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("Leader aux 3 points chaque saison NBA")}&select=id`,
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
