import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";
import { getLeagueState } from "@/lib/league-season";

/**
 * Ce qui porte déjà les données de la nouvelle saison.
 *
 * Les mini-jeux n'y figurent pas : ils ne dépendent d'aucune saison et ont leur
 * propre bandeau. Les ranger ici laissait entendre qu'ils basculaient avec le
 * reste, ce qui est faux.
 */
const LIVE_NOW = [
  { href: "/equipes", label: "Effectifs" },
  { href: "/trades", label: "Trade Machine" },
  { href: "/blessures", label: "Infirmerie" },
];

/**
 * Ce qui affiche encore la saison écoulée.
 *
 * Ces pages sont consultables normalement : seule leur saison de référence
 * diffère. Les présenter comme désactivées laissait croire à une indisponibilité
 * qui n'existe pas — le titre de la colonne suffit à porter la nuance.
 */
const PREVIOUS_SEASON = [
  { href: "/statistiques", label: "Statistiques" },
  { href: "/classement", label: "Classement" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/calendrier", label: "Calendrier" },
];

/**
 * Repère d'intersaison.
 *
 * Sans lui, une page de classement affiche la saison écoulée sans rien dire — le
 * visiteur croit consulter des données du moment. Le bandeau répond aux trois
 * questions utiles : où en est la ligue, qui a gagné, et qu'est-ce qui est déjà
 * à jour.
 *
 * Le découpage en deux colonnes remplace un paragraphe : « ce qui a basculé »
 * contre « ce qui attend le coup d'envoi » se lit d'un coup d'œil, là où une
 * phrase obligeait à démêler les deux.
 *
 * Ne rend rien hors intersaison, il n'y a alors rien à signaler.
 */
export default async function OffseasonNotice({
  variant = "full",
}: {
  /** `compact` : une seule ligne, pour coiffer une page de saison écoulée. */
  variant?: "full" | "compact";
}) {
  const { isOffseason, currentSeason, statsSeason, finalsChampion, finalsChampionTeam } =
    await getLeagueState();
  if (!isOffseason) return null;

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-rule bg-input/30 px-4 py-2.5">
        <span className="kicker shrink-0 text-accent-text">Intersaison</span>
        <p className="text-xs text-text-muted">
          Saison {statsSeason} terminée. La saison {currentSeason} n&apos;a pas encore commencé — ces
          données sont les dernières disponibles.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border border-rule bg-card">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />

      {/* Titre. Une seule police : mêler l'Anton condensé du titre aux chiffres
          tabulaires en mono faisait décrocher le millésime du reste. */}
      <div className="px-6 pt-6 pb-5 sm:px-9 sm:pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="kicker text-accent-text">Intersaison</p>
          <p className="kicker text-text-faint">Saison {statsSeason} terminée</p>
        </div>
        <h2 className="mt-3 font-display text-[clamp(2rem,5.5vw,3.25rem)] uppercase leading-[0.92] text-text-primary">
          Cap sur {currentSeason}
        </h2>
      </div>

      {/* Champion — une bande pleine largeur, pas une mention en passant. */}
      {finalsChampion && (
        <div className="flex items-center gap-4 border-y border-rule bg-input/40 px-6 py-4 sm:gap-5 sm:px-9">
          <img
            src={teamLogoUrl(finalsChampion)}
            alt=""
            className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
          />
          <div className="min-w-0">
            <p className="kicker text-text-faint">Champion {statsSeason}</p>
            <p className="mt-1 font-display text-xl uppercase leading-none text-text-primary sm:text-2xl">
              {finalsChampionTeam
                ? `${finalsChampionTeam.city} ${finalsChampionTeam.name}`
                : finalsChampion}
            </p>
          </div>
        </div>
      )}

      {/* Ce qui a basculé / ce qui attend. Le filet est fait par le fond,
          pour une séparation d'un pixel sans bordure surnuméraire. */}
      <div className="grid gap-px bg-rule sm:grid-cols-2">
        <div className="bg-card px-6 py-5 sm:px-9">
          <p className="kicker text-accent-text">Déjà en {currentSeason}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LIVE_NOW.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group inline-flex items-center gap-1.5 border border-rule px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-text-secondary transition-colors hover:border-accent hover:text-accent-text"
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

        <div className="bg-card px-6 py-5 sm:px-9">
          <p className="kicker text-text-faint">Encore en {statsSeason}</p>
          {/* Mêmes pastilles cliquables qu'à gauche : ces pages fonctionnent, seule
              leur saison de référence diffère. Le seul écart est la couleur de
              survol, neutre plutôt qu'accent, pour distinguer sans jamais
              suggérer une indisponibilité. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {PREVIOUS_SEASON.map((link) => (
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
          <p className="mt-3 text-[11px] leading-snug text-text-faint">
            Consultables normalement : elles basculeront sur {currentSeason} au premier match.
          </p>
        </div>
      </div>

      {/* Mini-jeux — la seule rubrique qui ne dépend d'aucune saison, donc la
          seule à offrir du neuf chaque jour d'ici au coup d'envoi. C'est le seul
          bouton plein de la carte : pendant l'intersaison, c'est l'action la plus
          utile qu'on puisse proposer. */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule bg-input/40 px-6 py-5 sm:px-9">
        <div className="min-w-0">
          <p className="kicker text-accent-text">Indépendant de la saison</p>
          <p className="mt-1.5 font-display text-lg uppercase leading-none text-text-primary sm:text-xl">
            Sept défis quotidiens
          </p>
          <p className="mt-1.5 text-xs text-text-muted">
            Un nouveau joueur à trouver chaque jour, intersaison comprise.
          </p>
        </div>
        <Link
          href="/mini-jeux"
          className="group inline-flex shrink-0 items-center gap-2 bg-accent px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
        >
          Jouer
          <ArrowRight
            size={14}
            strokeWidth={2}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </div>
  );
}
