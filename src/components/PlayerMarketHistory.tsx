import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { teamLogoUrl, teamNickname } from "@/lib/nba-teams";
import {
  eventAction,
  formatEventDate,
  KIND_LABELS,
  MINOR_KINDS,
  type MarketEvent,
} from "@/lib/market";

/**
 * Parcours d'un joueur sur le marché : échanges, signatures, coupes.
 *
 * Le journal des mouvements est indexé par joueur (index GIN sur `players`), ce
 * qui permet cette lecture ciblée sans balayer la saison. Les allers-retours en
 * G League sont écartés : sur une carrière, ils comptent par dizaines et n'ont
 * pas leur place dans un récit.
 *
 * Le composant ne rend rien s'il n'y a rien à raconter — un rookie n'a pas
 * d'historique, et une section vide sur sa fiche n'aiderait personne.
 */
export default async function PlayerMarketHistory({ playerId }: { playerId: number }) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("league_events")
    .select(
      "event_key, season, event_date, phase, kind, teams, from_team, to_team, players, assets, contract, detail, raw"
    )
    .contains("players", [{ player_id: playerId }])
    .order("event_date", { ascending: false })
    .limit(40);

  const events = ((data || []) as MarketEvent[]).filter((e) => !MINOR_KINDS.includes(e.kind));
  if (events.length === 0) return null;

  return (
    <div className="border border-rule bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-input/50 px-4 py-2.5 sm:px-6">
        <h2 className="kicker text-text-muted">Parcours sur le marché</h2>
        <span className="tnum font-mono text-[10px] uppercase tracking-wider text-text-faint">
          {events.length} mouvement{events.length > 1 ? "s" : ""}
        </span>
      </header>

      <ul>
        {events.map((event) => {
          const subject = event.from_team || event.to_team || event.teams[0];
          return (
            <li key={event.event_key} className="border-t border-rule first:border-t-0">
              <div className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-card-hover sm:px-6">
                <span className="tnum mt-0.5 w-[104px] shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-faint">
                  {formatEventDate(event.event_date)}
                </span>
                <span className="mt-0.5 w-[86px] shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  {KIND_LABELS[event.kind]}
                </span>
                <span className="mt-0.5 w-5 shrink-0">
                  {subject && (
                    <img src={teamLogoUrl(subject)} alt={subject} className="h-4 w-4 object-contain" />
                  )}
                </span>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-text-primary">
                  {subject && (
                    <span className="text-text-muted">{teamNickname(subject)} — </span>
                  )}
                  {eventAction(event)}
                </p>
                <Link
                  href={`/marche?season=${event.season}`}
                  className="mt-0.5 hidden shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-faint transition-colors hover:text-accent sm:block"
                >
                  {event.season}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
