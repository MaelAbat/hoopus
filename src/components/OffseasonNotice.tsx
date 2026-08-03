import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";
import { getLeagueState } from "@/lib/league-season";

/** Ce qui reste vivant entre deux saisons. */
const OFFSEASON_LINKS = [
  { href: "/equipes", label: "Effectifs" },
  { href: "/trades", label: "Trade Machine" },
  { href: "/blessures", label: "Infirmerie" },
  { href: "/mini-jeux", label: "Mini-jeux" },
];

/**
 * Repère d'intersaison.
 *
 * Sans lui, une page de classement ou de statistiques affiche la saison écoulée
 * sans rien dire — le visiteur croit consulter des données du moment. Le bandeau
 * énonce donc les trois faits utiles : la saison est finie, qui l'a gagnée, et
 * ce qui est déjà consultable pour la suivante.
 *
 * Ne rend rien hors intersaison, il n'y a alors rien à signaler.
 */
export default async function OffseasonNotice({
  variant = "full",
}: {
  /** `compact` : une seule ligne, pour coiffer une page de saison écoulée. */
  variant?: "full" | "compact";
}) {
  const { isOffseason, currentSeason, statsSeason, finalsChampion } = await getLeagueState();
  if (!isOffseason) return null;

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-rule bg-input/30 px-4 py-2.5">
        <span className="kicker shrink-0 text-accent-text">Intersaison</span>
        <p className="text-xs text-text-muted">
          Saison <span className="tnum text-text-secondary">{statsSeason}</span> terminée. La saison{" "}
          <span className="tnum text-text-secondary">{currentSeason}</span> n&apos;a pas encore
          commencé — ces données sont les dernières disponibles.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border border-rule bg-card">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <p className="kicker text-accent-text">Intersaison</p>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h2 className="font-display text-2xl uppercase leading-none text-text-primary sm:text-3xl">
            Cap sur <span className="tnum">{currentSeason}</span>
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Saison <span className="tnum">{statsSeason}</span> terminée
          </span>
        </div>

        {finalsChampion && (
          <div className="mt-4 flex items-center gap-3 border-t border-rule pt-4">
            <img
              src={teamLogoUrl(finalsChampion)}
              alt=""
              className="h-9 w-9 shrink-0 object-contain"
            />
            <div>
              <p className="kicker text-text-faint">Champion {statsSeason}</p>
              <p className="font-display text-lg uppercase leading-none text-text-primary">
                {finalsChampion}
              </p>
            </div>
          </div>
        )}

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-muted">
          Les statistiques et le classement restent ceux de la saison écoulée jusqu&apos;au premier
          match. Les effectifs, les salaires et les échanges, eux, sont déjà ceux de{" "}
          <span className="tnum text-text-secondary">{currentSeason}</span>.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {OFFSEASON_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group inline-flex items-center gap-1.5 border border-rule px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary"
            >
              {link.label}
              <ArrowRight
                size={12}
                strokeWidth={2}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
