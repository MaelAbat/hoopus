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
  e("Atlanta Hawks", "state farm arena", "state farm"),
  e("Boston Celtics", "td garden", "td"),
  e("Brooklyn Nets", "barclays center", "barclays"),
  e("Charlotte Hornets", "spectrum center", "spectrum"),
  e("Chicago Bulls", "united center", "united"),
  e("Cleveland Cavaliers", "rocket mortgage fieldhouse", "rocket mortgage"),
  e("Dallas Mavericks", "american airlines center", "american airlines", "aac"),
  e("Denver Nuggets", "ball arena", "ball"),
  e("Detroit Pistons", "little caesars arena", "little caesars"),
  e("Golden State Warriors", "chase center", "chase"),
  e("Houston Rockets", "toyota center", "toyota"),
  e("Indiana Pacers", "gainbridge fieldhouse", "gainbridge"),
  e("LA Clippers", "intuit dome", "intuit"),
  e("Los Angeles Lakers", "crypto.com arena", "crypto", "crypto.com", "staples center", "staples"),
  e("Memphis Grizzlies", "fedexforum", "fedex forum", "fedex"),
  e("Miami Heat", "kaseya center", "kaseya"),
  e("Milwaukee Bucks", "fiserv forum", "fiserv"),
  e("Minnesota Timberwolves", "target center", "target"),
  e("New Orleans Pelicans", "smoothie king center", "smoothie king"),
  e("New York Knicks", "madison square garden", "msg", "madison"),
  e("Oklahoma City Thunder", "paycom center", "paycom"),
  e("Orlando Magic", "kia center", "kia"),
  e("Philadelphia 76ers", "wells fargo center", "wells fargo"),
  e("Phoenix Suns", "footprint center", "footprint"),
  e("Portland Trail Blazers", "moda center", "moda"),
  e("Sacramento Kings", "golden 1 center", "golden 1", "golden one"),
  e("San Antonio Spurs", "frost bank center", "frost bank"),
  e("Toronto Raptors", "scotiabank arena", "scotiabank"),
  e("Utah Jazz", "delta center", "delta"),
  e("Washington Wizards", "capital one arena", "capital one"),
];

const listRes = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?title=eq.${encodeURIComponent("Les 30 salles NBA actuelles")}&select=id`,
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
