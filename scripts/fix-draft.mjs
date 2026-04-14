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
  e("2025 — Mavericks", "cooper flagg", "flagg", "cooper"),
  e("2024 — Hawks", "zaccharie risacher", "risacher"),
  e("2023 — Spurs", "victor wembanyama", "wembanyama", "wemby", "wemba"),
  e("2022 — Magic", "paolo banchero", "banchero"),
  e("2021 — Pistons", "cade cunningham", "cunningham"),
  e("2020 — Timberwolves", "anthony edwards", "edwards", "ant", "ant man"),
  e("2019 — Pelicans", "zion williamson", "zion", "williamson"),
  e("2018 — Suns", "deandre ayton", "ayton"),
  e("2017 — 76ers", "markelle fultz", "fultz"),
  e("2016 — 76ers", "ben simmons", "simmons"),
  e("2015 — Timberwolves", "karl-anthony towns", "karl anthony towns", "towns", "kat"),
  e("2014 — Cavaliers", "andrew wiggins", "wiggins"),
  e("2013 — Cavaliers", "anthony bennett", "bennett"),
  e("2012 — Hornets", "anthony davis", "davis", "ad"),
  e("2011 — Cavaliers", "kyrie irving", "irving", "kyrie"),
  e("2010 — Wizards", "john wall", "wall"),
  e("2009 — Clippers", "blake griffin", "griffin"),
  e("2008 — Bulls", "derrick rose", "rose", "d-rose", "d rose"),
  e("2007 — Trail Blazers", "greg oden", "oden"),
  e("2006 — Raptors", "andrea bargnani", "bargnani"),
  e("2005 — Bucks", "andrew bogut", "bogut"),
  e("2004 — Magic", "dwight howard", "howard", "dwight"),
  e("2003 — Cavaliers", "lebron james", "lebron", "james", "lbj"),
  e("2002 — Rockets", "yao ming", "yao"),
  e("2001 — Wizards", "kwame brown", "brown", "kwame"),
  e("2000 — Nets", "kenyon martin", "martin", "kenyon"),
  e("1999 — Bulls", "elton brand", "brand"),
  e("1998 — Clippers", "michael olowokandi", "olowokandi"),
  e("1997 — Spurs", "tim duncan", "duncan"),
  e("1996 — 76ers", "allen iverson", "iverson", "ai"),
  e("1995 — Warriors", "joe smith", "smith"),
  e("1994 — Bucks", "glenn robinson", "robinson", "big dog"),
  e("1993 — Magic", "chris webber", "webber", "c-webb"),
  e("1992 — Magic", "shaquille o'neal", "shaquille oneal", "shaq", "o'neal", "oneal"),
  e("1991 — Hornets", "larry johnson", "johnson", "larry"),
  e("1990 — Nets", "derrick coleman", "coleman"),
  e("1989 — Kings", "pervis ellison", "ellison"),
  e("1988 — Clippers", "danny manning", "manning"),
  e("1987 — Spurs", "david robinson", "robinson"),
  e("1986 — Cavaliers", "brad daugherty", "daugherty"),
  e("1985 — Knicks", "patrick ewing", "ewing"),
  e("1984 — Rockets", "hakeem olajuwon", "olajuwon", "hakeem", "akeem", "olajuwan"),
  e("1983 — Rockets", "ralph sampson", "sampson"),
  e("1982 — Lakers", "james worthy", "worthy"),
  e("1981 — Mavericks", "mark aguirre", "aguirre"),
  e("1980 — Warriors", "joe barry carroll", "carroll", "joe barry"),
  e("1979 — Lakers", "magic johnson", "magic", "earvin johnson", "johnson"),
  e("1978 — Trail Blazers", "mychal thompson", "thompson", "mychal"),
  e("1977 — Bucks", "kent benson", "benson"),
  e("1976 — Rockets", "john lucas", "lucas"),
  e("1975 — Hawks", "david thompson", "thompson"),
  e("1974 — Trail Blazers", "bill walton", "walton"),
  e("1973 — 76ers", "doug collins", "collins"),
  e("1972 — Trail Blazers", "larue martin", "martin"),
  e("1971 — Cavaliers", "austin carr", "carr"),
  e("1970 — Pistons", "bob lanier", "lanier"),
  e("1969 — Bucks", "lew alcindor", "kareem abdul-jabbar", "kareem", "alcindor", "kareem abdul jabbar", "abdul-jabbar"),
  e("1968 — Rockets (San Diego)", "elvin hayes", "hayes"),
  e("1967 — Pistons", "jimmy walker", "walker"),
  e("1966 — Knicks", "cazzie russell", "russell"),
  e("1965 — Warriors (San Francisco)", "fred hetzel", "hetzel"),
  e("1964 — Knicks", "jim barnes", "barnes"),
  e("1963 — Knicks", "art heyman", "heyman"),
  e("1962 — Zephyrs (Chicago)", "bill mcgill", "mcgill"),
  e("1961 — Packers (Chicago)", "walt bellamy", "bellamy"),
  e("1960 — Royals (Cincinnati)", "oscar robertson", "robertson", "big o"),
  e("1959 — Royals (Cincinnati)", "bob boozer", "boozer"),
  e("1958 — Lakers (Minneapolis)", "elgin baylor", "baylor"),
  e("1957 — Royals (Rochester)", "rod hundley", "hundley"),
  e("1956 — Royals (Rochester)", "sihugo green", "green"),
  e("1955 — Hawks (Milwaukee)", "dick ricketts", "ricketts"),
  e("1954 — Bullets (Baltimore)", "frank selvy", "selvy"),
  e("1953 — Bullets (Baltimore)", "ray felix", "felix"),
  e("1952 — Hawks (Milwaukee)", "mark workman", "workman"),
  e("1951 — Bullets (Baltimore)", "gene melchiorre", "melchiorre"),
  e("1950 — Celtics", "charlie share", "share"),
  e("1949 — Steamrollers (Providence)", "howie shannon", "shannon"),
  e("1948 — Steamrollers (Providence)", "andy tonkovich", "tonkovich"),
  e("1947 — Ironmen (Pittsburgh)", "clifton mcneely", "mcneely"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("N°1 de Draft depuis 1966")}&select=id`,
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
    body: JSON.stringify({ entries, title: "N°1 de Draft NBA depuis 1947", time_limit: 900 }),
  }
);
console.log(res.ok ? `OK: ${entries.length} entries` : `FAIL: ${res.status} ${await res.text()}`);
