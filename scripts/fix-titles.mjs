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
  // 11 titres
  e("11 titres — Celtics", "bill russell", "russell"),
  // 10 titres
  e("10 titres — Celtics", "sam jones", "jones"),
  // 8 titres
  e("8 titres — Celtics", "tom heinsohn", "heinsohn"),
  e("8 titres — Celtics", "k.c. jones", "kc jones", "k.c. jones"),
  e("8 titres — Celtics", "tom sanders", "sanders", "satch"),
  e("8 titres — Celtics", "john havlicek", "havlicek"),
  // 7 titres
  e("7 titres — Celtics", "frank ramsey", "ramsey"),
  e("7 titres — Rockets, Lakers, Spurs", "robert horry", "horry", "big shot rob"),
  // 6 titres
  e("6 titres — Celtics", "bob cousy", "cousy"),
  e("6 titres — Celtics", "jim loscutoff", "loscutoff"),
  e("6 titres — Bucks, Lakers", "kareem abdul-jabbar", "kareem", "abdul-jabbar", "kareem abdul jabbar", "jabbar"),
  e("6 titres — Bulls", "michael jordan", "jordan", "mj"),
  e("6 titres — Bulls", "scottie pippen", "pippen", "scottie"),
  // 5 titres
  e("5 titres — Lakers Minneapolis", "george mikan", "mikan"),
  e("5 titres — Lakers Minneapolis", "jim pollard", "pollard"),
  e("5 titres — Lakers Minneapolis, Hawks", "slater martin", "martin"),
  e("5 titres — Celtics", "larry siegfried", "siegfried"),
  e("5 titres — Celtics", "don nelson", "nelson"),
  e("5 titres — Lakers", "michael cooper", "cooper", "coop"),
  e("5 titres — Lakers", "magic johnson", "magic", "johnson"),
  e("5 titres — Pistons, Bulls", "dennis rodman", "rodman"),
  e("5 titres — Bulls, Spurs", "steve kerr", "kerr"),
  e("5 titres — Bulls, Lakers", "ron harper", "harper"),
  e("5 titres — Spurs", "tim duncan", "duncan"),
  e("5 titres — Lakers", "kobe bryant", "kobe", "bryant"),
  e("5 titres — Lakers", "derek fisher", "fisher"),
  // 4 titres
  e("4 titres — Lakers Minneapolis", "vern mikkelsen", "mikkelsen"),
  e("4 titres — Royals, Lakers Minneapolis", "frank saul", "saul"),
  e("4 titres — Celtics", "bill sharman", "sharman"),
  e("4 titres — Warriors, Lakers", "jamaal wilkes", "wilkes"),
  e("4 titres — Celtics, Bulls", "robert parish", "parish"),
  e("4 titres — Lakers", "kurt rambis", "rambis"),
  e("4 titres — Pistons, Bulls, Lakers", "john salley", "salley"),
  e("4 titres — Bulls, Spurs", "will perdue", "perdue"),
  e("4 titres — Bulls, Lakers", "horace grant", "grant", "horace"),
  e("4 titres — Lakers, Heat", "shaquille o'neal", "shaq", "shaquille", "o'neal", "oneal"),
  e("4 titres — Spurs", "manu ginobili", "ginobili", "manu"),
  e("4 titres — Spurs", "tony parker", "parker"),
  e("4 titres — Heat, Cavaliers, Lakers", "lebron james", "lebron", "james", "lbj"),
  e("4 titres — Warriors", "stephen curry", "curry", "steph"),
  e("4 titres — Warriors", "draymond green", "green", "draymond"),
  e("4 titres — Warriors", "andre iguodala", "iguodala"),
  e("4 titres — Warriors", "klay thompson", "thompson", "klay"),
  // 3 titres
  e("3 titres — Lakers Minneapolis", "bob harrison", "harrison"),
  e("3 titres — Lakers Minneapolis, Celtics", "clyde lovellette", "lovellette"),
  e("3 titres — Celtics", "gene conley", "conley"),
  e("3 titres — Celtics", "willie naulls", "naulls"),
  e("3 titres — Celtics, Supersonics", "paul silas", "silas"),
  e("3 titres — Supersonics, Celtics", "dennis johnson", "johnson", "dj"),
  e("3 titres — Celtics", "larry bird", "bird"),
  e("3 titres — Celtics", "kevin mchale", "mchale"),
  e("3 titres — Celtics, Pistons", "gerald henderson", "henderson"),
  e("3 titres — Lakers", "byron scott", "scott", "byron"),
  e("3 titres — Lakers", "james worthy", "worthy"),
  e("3 titres — Lakers", "a.c. green", "ac green", "a.c. green"),
  e("3 titres — Bulls", "b.j. armstrong", "armstrong", "bj armstrong"),
  e("3 titres — Pistons, Bulls", "james edwards", "edwards"),
  e("3 titres — Bulls", "bill cartwright", "cartwright"),
  e("3 titres — Bulls", "stacey king", "king"),
  e("3 titres — Bulls", "john paxson", "paxson"),
  e("3 titres — Bulls", "scott williams", "williams"),
  e("3 titres — Rockets, Spurs", "mario elie", "elie"),
  e("3 titres — Rockets, Celtics", "sam cassell", "cassell"),
  e("3 titres — Bulls", "randy brown", "brown"),
  e("3 titres — Bulls", "jud buechler", "buechler"),
  e("3 titres — Bulls", "toni kukoc", "kukoc", "kukoč", "kukoch"),
  e("3 titres — Lakers", "rick fox", "fox"),
  e("3 titres — Lakers", "devean george", "george"),
  e("3 titres — Lakers", "brian shaw", "shaw"),
  e("3 titres — Spurs", "bruce bowen", "bowen"),
  e("3 titres — Heat", "udonis haslem", "haslem", "ud"),
  e("3 titres — Heat", "dwyane wade", "wade", "dwyane", "dwayne wade"),
  e("3 titres — Heat, Cavaliers", "james jones", "jones"),
  e("3 titres — Spurs, Raptors, Lakers", "danny green", "green", "danny"),
  e("3 titres — Warriors", "shaun livingston", "livingston"),
  e("3 titres — Warriors, Raptors", "patrick mccaw", "mccaw"),
  e("3 titres — Warriors, Lakers", "javale mcgee", "mcgee"),
  e("3 titres — Warriors", "kevon looney", "looney"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("Joueurs ayant remporté 3+ titres NBA")}&select=id`,
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
    body: JSON.stringify({ entries, time_limit: 720 }),
  }
);
console.log(res.ok ? `OK: ${entries.length} entries` : `FAIL: ${res.status} ${await res.text()}`);
