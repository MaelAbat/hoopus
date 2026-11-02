/**
 * Relecture des scores du soir chez ESPN, partagée par /api/live-scores et
 * /api/ticker.
 *
 * Le scoreboard ESPN d'une journée donne tous ses matchs en une requête. Seuls
 * les matchs dont le score ou le statut a bougé sont écrits : un soir de match,
 * ces routes passent toutes les trente secondes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDayGames } from "./espn-schedule";
import { upsertChanged } from "./write-changed";

/** Intervalle minimal entre deux lectures ESPN d'une même journée. */
export const SYNC_STALE_MS = 25_000;

/**
 * Heure de la dernière lecture ESPN, par journée. L'étranglement reposait sur
 * `updated_at` ; maintenant qu'un match inchangé n'est plus réécrit, cette date
 * ne bouge plus et ne peut plus dire quand ESPN a été interrogé. Gardée en
 * mémoire de l'instance — partagée par les requêtes qu'elle sert —, elle évite
 * de relire ESPN à chaque visiteur.
 */
const lastChecked = new Map<string, number>();

/** Date et heure courantes à New York, là où le calendrier range les matchs. */
export function easternNow(): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** `YYYY-MM-DD` décalé de `days` jours. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Le match a-t-il pu commencer ? `game_time` porte l'heure de l'Est sur une date
 * fictive (« 1900-01-01T19:30:00Z »). Avant le coup d'envoi, rien ne bouge :
 * inutile d'interroger ESPN toutes les 25 secondes depuis le matin.
 */
export function mayHaveStarted(
  g: { game_date: string; game_time: string | null },
  now: { date: string; minutes: number }
): boolean {
  if (g.game_date < now.date) return true;
  if (g.game_date > now.date) return false;
  const m = g.game_time?.match(/T(\d{2}):(\d{2})/);
  if (!m) return true;
  return now.minutes >= Number(m[1]) * 60 + Number(m[2]);
}

/** La journée a-t-elle été relue chez ESPN il y a moins de SYNC_STALE_MS ? */
export function checkedRecently(date: string, nowMs = Date.now()): boolean {
  return nowMs - (lastChecked.get(date) ?? 0) <= SYNC_STALE_MS;
}

/**
 * Relit chez ESPN les scores des journées données et écrit ceux qui ont changé.
 * Une journée lue il y a moins de SYNC_STALE_MS est sautée. Renvoie `true` si
 * au moins une journée a été relue.
 */
export async function refreshEspnDays(supabase: SupabaseClient, dates: string[]): Promise<boolean> {
  const nowMs = Date.now();
  const due = [...new Set(dates)].filter((d) => !checkedRecently(d, nowMs));
  await Promise.all(
    due.map(async (date) => {
      lastChecked.set(date, nowMs);
      try {
        const rows = await fetchDayGames(date);
        if (rows.length === 0) return;
        const { data: sameDay } = await supabase
          .from("games")
          .select("game_id, status, status_text, home_score, away_score")
          .eq("game_date", date);
        const existing = new Map<string, Record<string, unknown>>(
          (sameDay ?? []).map((g) => [g.game_id, g])
        );
        await upsertChanged(supabase, "games", rows, {
          existing,
          key: ["game_id"],
          compare: ["status", "status_text", "home_score", "away_score"],
          onConflict: "game_id",
        });
      } catch {
        // ESPN muet : on rend les scores en base, le prochain appel réessaiera.
      }
    })
  );
  return due.length > 0;
}
