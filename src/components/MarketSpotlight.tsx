import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLeagueState } from "@/lib/league-season";
import { getSeasonPhases } from "@/lib/season-phases-db";
import { formatPhaseDate, phaseForDate, PHASE_LABELS, type PhaseKey } from "@/lib/season-phases";
import { eventAction, formatEventDateShort, MINOR_KINDS, type MarketEvent } from "@/lib/market";
import { seasonAfter } from "@/lib/season";
import { teamNickname } from "@/lib/nba-teams";
import TeamMark from "./TeamMark";

/**
 * Ce qui se joue en ce moment hors des parquets, sur l'accueil.
 *
 * Cinq moments de l'année méritent la première place : la draft, l'ouverture de
 * la free agency, la date limite des échanges, le marché des rachats et la
 * loterie. Le reste du temps ce bloc ne s'affiche pas — mettre en avant un marché
 * endormi en décembre ne servirait personne.
 *
 * Ne rend rien non plus si la période en cours n'a produit aucun mouvement : une
 * annonce sans contenu se retourne contre elle.
 */

/** Périodes qui valent une mise en avant, et la rubrique vers laquelle pointer. */
const SPOTLIGHT: Record<string, { focus: "draft" | "market"; headline: string }> = {
  draft: { focus: "draft", headline: "La draft se joue en ce moment" },
  lottery: { focus: "draft", headline: "La loterie fixe l'ordre de la prochaine draft" },
  free_agency: { focus: "market", headline: "La free agency est ouverte" },
  trade_deadline: { focus: "market", headline: "Dernier jour pour échanger" },
  buyout_market: { focus: "market", headline: "Le marché des rachats est ouvert" },
};

function isSpotlightPhase(phase: PhaseKey | null): phase is PhaseKey {
  return !!phase && phase in SPOTLIGHT;
}

export default async function MarketSpotlight() {
  const { currentSeason } = await getLeagueState();
  const phases = await getSeasonPhases(currentSeason);

  const today = new Date().toISOString().slice(0, 10);
  const phase = phaseForDate(today, phases);
  if (!isSpotlightPhase(phase)) return null;

  const window = phases.find((p) => p.phase === phase);
  if (!window) return null;

  const supabase = await createClient();

  // Les mouvements sont cherchés par dates plutôt que par la colonne `phase` :
  // celle-ci est écrite au moment du sync et peut retarder d'une définition.
  const [{ data: rows }, { count }] = await Promise.all([
    supabase
      .from("league_events")
      .select("event_key, season, event_date, phase, kind, teams, from_team, to_team, players, assets, contract, detail, raw")
      .eq("season", currentSeason)
      .gte("event_date", window.startsOn)
      .lte("event_date", window.endsOn)
      .order("event_date", { ascending: false })
      .limit(40),
    supabase
      .from("league_events")
      .select("*", { count: "exact", head: true })
      .eq("season", currentSeason)
      .gte("event_date", window.startsOn)
      .lte("event_date", window.endsOn),
  ]);

  const events = ((rows || []) as MarketEvent[]).filter((e) => !MINOR_KINDS.includes(e.kind));
  if (events.length === 0) return null;

  const { focus, headline } = SPOTLIGHT[phase];
  const latest = events.slice(0, 3);

  // Pendant la loterie, la draft à venir est celle de la saison suivante : c'est
  // elle que le tirage ordonne.
  const draftHref = phase === "lottery" ? `/draft/${seasonAfter(currentSeason)}` : `/draft/${currentSeason}`;

  return (
    <div className="relative overflow-hidden border border-rule bg-card">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 py-5 sm:px-9 sm:py-6">
        <div>
          <p className="kicker text-accent-text">{PHASE_LABELS[phase]}</p>
          <p className="mt-2 font-display text-2xl leading-none text-text-primary sm:text-3xl">
            {headline}
          </p>
        </div>
        <p className="kicker text-text-faint">
          {window.startsOn === window.endsOn
            ? formatPhaseDate(window.startsOn)
            : `depuis le ${formatPhaseDate(window.startsOn)}`}
          {count ? ` · ${count} mouvements` : ""}
        </p>
      </div>

      <ul className="border-t border-rule">
        {latest.map((event) => {
          const subject = event.from_team || event.to_team || event.teams[0];
          return (
            <li
              key={event.event_key}
              className="flex items-start gap-3 border-b border-rule px-6 py-2.5 last:border-b-0 sm:px-9"
            >
              <span className="tnum mt-0.5 w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-faint">
                {formatEventDateShort(event.event_date)}
              </span>
              {subject && <TeamMark tricode={subject} size={18} />}
              <p className="min-w-0 flex-1 text-sm leading-snug text-text-primary">
                {subject && <span className="text-text-muted">{teamNickname(subject)} — </span>}
                {eventAction(event)}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t border-rule bg-input/40 px-6 py-4 sm:px-9">
        <Link
          href={focus === "draft" ? draftHref : "/marche"}
          className="group inline-flex shrink-0 items-center gap-2 bg-accent px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
        >
          {focus === "draft" ? "Voir la draft" : "Voir le marché"}
          <ArrowRight
            size={14}
            strokeWidth={2}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </Link>
        <Link
          href={focus === "draft" ? "/marche" : draftHref}
          className="inline-flex shrink-0 items-center border border-border-hover px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-text-primary transition-colors hover:bg-input"
        >
          {focus === "draft" ? "Le marché" : "La draft"}
        </Link>
      </div>
    </div>
  );
}

/** Rubrique à mettre en tête du sommaire, selon la période. `null` hors période. */
export async function spotlightFocus(): Promise<"draft" | "market" | null> {
  const { currentSeason } = await getLeagueState();
  const phases = await getSeasonPhases(currentSeason);
  const phase = phaseForDate(new Date().toISOString().slice(0, 10), phases);
  return isSpotlightPhase(phase) ? SPOTLIGHT[phase].focus : null;
}
