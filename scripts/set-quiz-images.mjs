/**
 * Set image_url for the 20 new quizzes.
 * Usage: node scripts/set-quiz-images.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const images = {
  "N°1 de Draft depuis 1966":
    "https://upload.wikimedia.org/wikipedia/commons/3/3d/LeBron_James_Cavaliers_27042008.jpg",
  "MVP du All-Star Game depuis 1953":
    "https://upload.wikimedia.org/wikipedia/commons/3/35/NBA_All-Star_Game_2010.jpg",
  "Leader aux 3 points chaque saison NBA":
    "https://upload.wikimedia.org/wikipedia/commons/2/27/Stephen_Curry_Shooting_(cropped).jpg",
  "Les 30 franchises NBA actuelles":
    "https://upload.wikimedia.org/wikipedia/commons/1/19/Mci_center_jan2006a.jpg",
  "Top 20 tireurs à 3 points All-Time":
    "https://upload.wikimedia.org/wikipedia/commons/7/7a/Stephen_Curry_close_up.jpg",
  "Joueurs français ayant joué en NBA":
    "https://upload.wikimedia.org/wikipedia/commons/d/dc/Tony_parker_spurs_vs_wizards_cropped.jpg",
  "Joueurs ayant marqué 60+ points dans un match NBA":
    "https://upload.wikimedia.org/wikipedia/commons/4/4b/Wilt_Chamberlain_1962.jpeg",
  "Les 30 salles NBA actuelles":
    "https://upload.wikimedia.org/wikipedia/commons/d/d4/Madison_Square_Garden%2C_Manhattan%2C_New_York_%282481311144%29.jpg",
  "Joueurs ayant joué 20+ saisons en NBA":
    "https://upload.wikimedia.org/wikipedia/commons/3/35/Vince_Carter_Suns_cropped.jpg",
  "Toutes les villes ayant eu une franchise NBA/BAA":
    "https://upload.wikimedia.org/wikipedia/commons/7/71/NBA_basketball%2C_Raptors_in_Phoenix.jpg",
  "Joueurs ayant remporté 3+ titres NBA":
    "https://upload.wikimedia.org/wikipedia/commons/9/96/Kobe_Bryant_8.jpg",
  "Franchises NBA n'ayant jamais gagné de titre":
    "https://upload.wikimedia.org/wikipedia/commons/4/46/Maccabi_Tel_Aviv_basketball_team_playing_against_the_Phoenix_Suns_%28FL45862783%29.jpg",
  "Top 20 marqueurs en playoffs All-Time":
    "https://upload.wikimedia.org/wikipedia/commons/2/2b/Lebron_finals_2015.jpg",
  "Joueurs ayant réalisé un quadruple-double en NBA":
    "https://upload.wikimedia.org/wikipedia/commons/b/bd/Hakeem.jpg",
  "Top 30 matchs joués All-Time NBA":
    "https://upload.wikimedia.org/wikipedia/commons/8/88/Robert_Parish.jpg",
  "Top 20 coaches NBA les plus victorieux":
    "https://upload.wikimedia.org/wikipedia/commons/1/13/Gregg_Popovich_sideline.jpg",
  "Numéros retirés par les Boston Celtics":
    "https://upload.wikimedia.org/wikipedia/commons/2/2f/Larry_Bird_Lipofsky.jpg",
  "Numéros retirés par les Los Angeles Lakers":
    "https://upload.wikimedia.org/wikipedia/commons/2/24/Lakers_banners_%26_retired_jerseys_2024.jpg",
  "Joueurs ayant marqué 50+ points en playoffs NBA":
    "https://upload.wikimedia.org/wikipedia/commons/0/05/Michael_Jordan_1986_Playoffs.jpg",
  "Top 25 triple-doubles en carrière NBA":
    "https://upload.wikimedia.org/wikipedia/commons/9/90/Russell_Westbrook_dribbling_vs_Cavs_%28cropped%29.jpg",
};

let ok = 0;
for (const [title, imageUrl] of Object.entries(images)) {
  const res = await fetch(
    `${URL}/rest/v1/quizzes?title=eq.${encodeURIComponent(title)}`,
    {
      method: "PATCH",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ image_url: imageUrl }),
    }
  );
  if (res.ok) {
    ok++;
    console.log(`OK: ${title}`);
  } else {
    console.error(`FAIL: ${title} — ${res.status} ${await res.text()}`);
  }
}
console.log(`\nDone: ${ok}/${Object.keys(images).length}`);
