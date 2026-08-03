import Link from "next/link";
import { ArrowRight, CalendarClock, Database } from "lucide-react";
import type { SeasonStatus } from "@/lib/season";

/**
 * État vide d'une page de saison.
 *
 * Une saison sans données a deux causes très différentes, qu'il faut distinguer :
 * elle n'a pas encore commencé — auquel cas il n'y a rien à faire qu'attendre —
 * ou la synchronisation n'a pas tourné. L'ancien message « Synchronisation
 * requise » laissait croire à une panne pendant toute l'intersaison.
 */
export default function SeasonEmptyState({
  season,
  status,
  what,
  fallbackSeason,
}: {
  season: string;
  status: SeasonStatus;
  /** Ce qui manque, au pluriel : « Les statistiques », « Le classement ». */
  what: string;
  /** Dernière saison consultable, proposée en repli. */
  fallbackSeason?: string | null;
}) {
  const upcoming = status === "upcoming";
  const Icon = upcoming ? CalendarClock : Database;

  return (
    <div className="border border-rule bg-card px-6 py-12 text-center">
      <Icon size={26} strokeWidth={1.75} className="mx-auto text-text-faint" />

      <p className="kicker mt-4 text-accent-text">
        {upcoming ? "Saison à venir" : "Données absentes"}
      </p>

      <h2 className="mt-2 font-display text-xl uppercase leading-none text-text-primary sm:text-2xl">
        {upcoming ? (
          <>
            La saison <span className="tnum">{season}</span> n&apos;a pas commencé
          </>
        ) : (
          <>
            Rien pour <span className="tnum">{season}</span>
          </>
        )}
      </h2>

      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-muted">
        {upcoming ? (
          <>
            {what} apparaîtront dès le premier match. En attendant, les effectifs et les salaires
            de <span className="tnum text-text-secondary">{season}</span> sont déjà à jour.
          </>
        ) : (
          <>{what} de cette saison ne sont pas encore synchronisées.</>
        )}
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {fallbackSeason && (
          <Link
            href={`?season=${fallbackSeason}`}
            className="group inline-flex items-center gap-1.5 border border-rule px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary"
          >
            Voir <span className="tnum">{fallbackSeason}</span>
            <ArrowRight
              size={12}
              strokeWidth={2}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
        )}
        {upcoming && (
          <Link
            href="/equipes"
            className="group inline-flex items-center gap-1.5 border border-rule px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary"
          >
            Effectifs <span className="tnum">{season}</span>
            <ArrowRight
              size={12}
              strokeWidth={2}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
        )}
      </div>
    </div>
  );
}
