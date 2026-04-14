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
  e("2026", "anthony edwards", "edwards", "ant", "ant man"),
  e("2025", "stephen curry", "curry", "steph", "steph curry"),
  e("2024", "damian lillard", "lillard", "dame"),
  e("2023", "jayson tatum", "tatum"),
  e("2022", "stephen curry", "curry", "steph", "steph curry"),
  e("2021", "giannis antetokounmpo", "giannis", "antetokounmpo", "antetokumpo", "antetokoumpo"),
  e("2020", "kawhi leonard", "leonard", "kawhi"),
  e("2019", "kevin durant", "durant", "kd"),
  e("2018", "lebron james", "lebron", "james", "lbj"),
  e("2017", "anthony davis", "davis", "ad"),
  e("2016", "russell westbrook", "westbrook", "russ"),
  e("2015", "russell westbrook", "westbrook", "russ"),
  e("2014", "kyrie irving", "irving", "kyrie"),
  e("2013", "chris paul", "paul", "cp3"),
  e("2012", "kevin durant", "durant", "kd"),
  e("2011", "kobe bryant", "kobe", "bryant"),
  e("2010", "dwyane wade", "wade", "dwyane", "dwayne wade"),
  e("2009 (co-MVP)", "kobe bryant / shaquille o'neal", "kobe", "shaq", "kobe bryant", "shaquille o'neal", "bryant", "o'neal"),
  e("2008", "lebron james", "lebron", "james", "lbj"),
  e("2007", "kobe bryant", "kobe", "bryant"),
  e("2006", "lebron james", "lebron", "james", "lbj"),
  e("2005", "allen iverson", "iverson", "ai"),
  e("2004", "shaquille o'neal", "shaq", "shaquille", "o'neal", "oneal"),
  e("2003", "kevin garnett", "garnett", "kg"),
  e("2002", "kobe bryant", "kobe", "bryant"),
  e("2001", "allen iverson", "iverson", "ai"),
  e("2000 (co-MVP)", "shaquille o'neal / tim duncan", "shaq", "duncan", "shaquille o'neal", "tim duncan", "o'neal"),
  e("1999 — Annulé (lockout)", "annule", "lockout", "pas de match", "aucun", "annulé", "-"),
  e("1998", "michael jordan", "jordan", "mj"),
  e("1997", "glen rice", "rice"),
  e("1996", "michael jordan", "jordan", "mj"),
  e("1995", "mitch richmond", "richmond"),
  e("1994", "scottie pippen", "pippen", "scottie"),
  e("1993 (co-MVP)", "karl malone / john stockton", "karl malone", "malone", "john stockton", "stockton", "malone / stockton", "stockton / malone"),
  e("1992", "magic johnson", "magic", "johnson"),
  e("1991", "charles barkley", "barkley", "chuck"),
  e("1990", "magic johnson", "magic", "johnson"),
  e("1989", "karl malone", "malone"),
  e("1988", "michael jordan", "jordan", "mj"),
  e("1987", "tom chambers", "chambers"),
  e("1986", "isiah thomas", "isiah", "thomas"),
  e("1985", "ralph sampson", "sampson"),
  e("1984", "isiah thomas", "isiah", "thomas"),
  e("1983", "julius erving", "erving", "dr j", "dr. j", "julius"),
  e("1982", "larry bird", "bird"),
  e("1981", "nate archibald", "archibald", "nate", "tiny archibald"),
  e("1980", "george gervin", "gervin", "iceman"),
  e("1979", "david thompson", "thompson"),
  e("1978", "randy smith", "smith"),
  e("1977", "julius erving", "erving", "dr j", "dr. j"),
  e("1976", "dave bing", "bing"),
  e("1975", "walt frazier", "frazier", "clyde"),
  e("1974", "bob lanier", "lanier"),
  e("1973", "dave cowens", "cowens"),
  e("1972", "jerry west", "west"),
  e("1971", "lenny wilkens", "wilkens"),
  e("1970", "willis reed", "reed"),
  e("1969", "oscar robertson", "robertson", "big o"),
  e("1968", "hal greer", "greer"),
  e("1967", "rick barry", "barry"),
  e("1966", "adrian smith", "smith"),
  e("1965", "jerry lucas", "lucas"),
  e("1964", "oscar robertson", "robertson", "big o"),
  e("1963", "bill russell", "russell"),
  e("1962", "bob pettit", "pettit"),
  e("1961", "oscar robertson", "robertson", "big o"),
  e("1960", "wilt chamberlain", "chamberlain", "wilt"),
  e("1959 (co-MVP)", "elgin baylor / bob pettit", "elgin baylor", "baylor", "bob pettit", "pettit"),
  e("1958", "bob pettit", "pettit"),
  e("1957", "bob cousy", "cousy"),
  e("1956", "bob pettit", "pettit"),
  e("1955", "bill sharman", "sharman"),
  e("1954", "bob cousy", "cousy"),
  e("1953", "george mikan", "mikan"),
  e("1952", "paul arizin", "arizin"),
  e("1951", "ed macauley", "macauley"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("MVP du All-Star Game depuis 1953")}&select=id`,
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
    body: JSON.stringify({ entries, title: "MVP du All-Star Game depuis 1951" }),
  }
);
console.log(res.ok ? `OK: ${entries.length} entries` : `FAIL: ${res.status} ${await res.text()}`);
