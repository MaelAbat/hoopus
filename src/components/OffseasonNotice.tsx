import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";
import { getLeagueState } from "@/lib/league-season";

/**
 * État de la ligue entre deux saisons, sur l'accueil.
 *
 * Le parti pris est de le faire comprendre sans le dire. Un champion couronné et
 * une saison suivante nommée suffisent : personne n'a besoin qu'on lui annonce
 * « intersaison ». Une version précédente le répétait sur cinq écrans, avec deux
 * colonnes expliquant quelles rubriques avaient basculé — c'était documenter le
 * fonctionnement du site plutôt que le rendre lisible.
 *
 * Le détail par rubrique est porté là où il compte : le statut de la saison à
 * côté de chaque sélecteur, et la provenance des chiffres au pied des tableaux
 * concernés.
 *
 * Ne rend rien hors intersaison.
 */
export default async function OffseasonNotice() {
  const { isOffseason, currentSeason, statsSeason, finalsChampion, finalsChampionTeam } =
    await getLeagueState();
  if (!isOffseason || !finalsChampion) return null;

  return (
    <div className="relative overflow-hidden border border-rule bg-card">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />

      {/* Le champion, seul et en grand. Un titre qui vient d'être remporté dit à
          lui seul que la saison est derrière nous. */}
      <div className="flex items-center gap-5 px-6 py-6 sm:gap-7 sm:px-9 sm:py-8">
        <img
          src={teamLogoUrl(finalsChampion)}
          alt=""
          className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20"
        />
        <div className="min-w-0">
          <p className="kicker text-accent-text">Champion {statsSeason}</p>
          <p className="mt-2 font-display text-2xl uppercase leading-none text-text-primary sm:text-3xl">
            {finalsChampionTeam
              ? `${finalsChampionTeam.city} ${finalsChampionTeam.name}`
              : finalsChampion}
          </p>
        </div>
      </div>

      {/* Une ligne de pied : ce qui vient, et la seule chose à faire d'ici là.
          Nommer la saison suivante suffit à situer où l'on se trouve. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-rule bg-input/40 px-6 py-4 sm:px-9">
        <p className="kicker text-text-faint">Prochaine saison · {currentSeason}</p>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-text-muted sm:inline">Sept défis quotidiens</span>
          <Link
            href="/mini-jeux"
            className="group inline-flex shrink-0 items-center gap-2 bg-accent px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
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
    </div>
  );
}
