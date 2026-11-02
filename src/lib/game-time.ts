/**
 * Heure d'un match pour un lecteur français.
 *
 * `game_time` porte l'heure de l'Est sur une date fictive
 * (« 1900-01-01T20:00:00Z ») : seule l'heure compte, et elle n'est pas en UTC.
 * Elle est rattachée à la date du match pour tenir compte des changements
 * d'heure, qui ne tombent pas le même jour aux États-Unis et en France.
 */
export function toParisTime(gameDate: string, gameTime: string): string {
  if (!gameTime) return "";
  const timePart = gameTime.includes("T") ? gameTime.split("T")[1] : gameTime;
  const match = timePart.match(/^(\d{2}):(\d{2})/);
  if (!match) return "";
  const etHours = parseInt(match[1]);
  const etMinutes = parseInt(match[2]);
  const fakeUtc = new Date(Date.UTC(
    parseInt(gameDate.slice(0, 4)),
    parseInt(gameDate.slice(5, 7)) - 1,
    parseInt(gameDate.slice(8, 10)),
    etHours, etMinutes
  ));
  const etFormatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).format(fakeUtc);
  const etHourCheck = parseInt(etFormatted);
  // -4 ou -5 ; ramené dans cet intervalle quand l'heure UTC passe minuit.
  let etOffset = etHourCheck - etHours;
  if (etOffset > 12) etOffset -= 24;
  const realUtc = new Date(fakeUtc.getTime() - etOffset * 3600000);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(realUtc);
}

/** Date du jour à New York (`YYYY-MM-DD`), là où le calendrier range les matchs. */
export function easternToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
