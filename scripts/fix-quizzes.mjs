/**
 * Fix quizzes with data from research agents.
 * Usage: node scripts/fix-quizzes.mjs
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

const e = (label, ...answers) => ({ label, answers });

async function getQuiz(title) {
  const res = await fetch(
    `${URL}/rest/v1/quizzes?title=eq.${encodeURIComponent(title)}&select=id,entries`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
  );
  const data = await res.json();
  return data[0] || null;
}

async function updateEntries(id, entries) {
  const res = await fetch(`${URL}/rest/v1/quizzes?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ entries }),
  });
  return res.ok;
}

// ─── Fix Celtics retired numbers: add #00 Parish, #9 Rondo ───
{
  const q = await getQuiz("Numéros retirés par les Boston Celtics");
  if (q) {
    const entries = [...q.entries];
    const names = entries.map(e => e.answers[0]);
    if (!names.includes("robert parish")) {
      entries.push(e("N°00", "robert parish", "parish"));
    }
    if (!names.includes("rajon rondo")) {
      entries.push(e("N°9", "rajon rondo", "rondo"));
    }
    if (await updateEntries(q.id, entries)) {
      console.log(`OK: Celtics (${entries.length} entries)`);
    }
  }
}

// ─── Fix Lakers retired numbers: add #21 Michael Cooper ───
{
  const q = await getQuiz("Numéros retirés par les Los Angeles Lakers");
  if (q) {
    const entries = [...q.entries];
    const names = entries.map(e => e.answers[0]);
    if (!names.includes("michael cooper")) {
      entries.push(e("N°21", "michael cooper", "cooper", "coop"));
    }
    if (await updateEntries(q.id, entries)) {
      console.log(`OK: Lakers (${entries.length} entries)`);
    }
  }
}

// ─── Fix French players: add missing ───
{
  const q = await getQuiz("Joueurs français ayant joué en NBA");
  if (q) {
    const entries = [...q.entries];
    const names = entries.map(e => e.answers[0]);
    const toAdd = [
      e("Thunder (2020-2023)", "theo maledon", "maledon", "théo"),
      e("Clippers, Grizzlies (2022-...)", "moussa diabate", "diabate", "diabaté"),
      e("Bulls (2020-2021)", "adam mokoka", "mokoka"),
      e("Hornets (2024-...)", "tidjane salaun", "salaun", "salaün"),
      e("Lakers (2024-...)", "armel traore", "traore", "traoré"),
    ];
    for (const entry of toAdd) {
      if (!names.includes(entry.answers[0])) {
        entries.push(entry);
      }
    }
    if (await updateEntries(q.id, entries)) {
      console.log(`OK: French players (${entries.length} entries)`);
    }
  }
}

// ─── Fix 60+ points: add missing scorers ───
{
  const q = await getQuiz("Joueurs ayant marqué 60+ points dans un match NBA");
  if (q) {
    const entries = [...q.entries];
    const names = entries.map(e => e.answers[0]);
    const toAdd = [
      e("61 pts — 2000 vs Clippers", "shaquille o'neal", "shaq", "shaquille", "o'neal", "oneal"),
      e("60 pts — 2016 vs Jazz (farewell)", "kobe bryant", "kobe", "bryant"),
      e("63 pts — 1949 vs Jets", "joe fulks", "fulks"),
      e("60 pts — 1990 vs Supersonics", "tom chambers", "chambers"),
    ];
    for (const entry of toAdd) {
      if (!names.includes(entry.answers[0])) {
        entries.push(entry);
      }
    }
    if (await updateEntries(q.id, entries)) {
      console.log(`OK: 60+ points (${entries.length} entries)`);
    }
  }
}

// ─── Fix arenas: update 76ers ───
{
  const q = await getQuiz("Les 30 salles NBA actuelles");
  if (q) {
    const entries = q.entries.map(entry => {
      if (entry.label === "Philadelphia 76ers") {
        return e("Philadelphia 76ers", "xfinity mobile arena", "xfinity", "wells fargo center", "wells fargo");
      }
      return entry;
    });
    if (await updateEntries(q.id, entries)) {
      console.log(`OK: Arenas updated`);
    }
  }
}

console.log("\nDone!");
