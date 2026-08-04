import Link from "next/link";
import { teamLogoUrl, teamNickname } from "@/lib/nba-teams";
import { seasonBefore } from "@/lib/season";

/**
 * Draft et loterie, résumées dans la rubrique Marché.
 *
 * La draft a sa page complète, mais elle appartient au marché : c'est l'un de ses
 * sept temps forts. Renvoyer vers elle par un simple lien la rendait invisible.
 * Ce panneau montre donc l'essentiel — les cinq premiers choix, le haut de la
 * grille de loterie — et laisse la page de draft pour le détail.
 */

export interface DraftHighlight {
  pick_overall: number;
  team_tricode: string;
  player_name: string | null;
  player_id: number | null;
}

export interface LotteryHighlight {
  team_tricode: string;
  pre_lottery_rank: number;
  wins: number | null;
  losses: number | null;
  odds_top1: number | null;
  tied: boolean;
}

export default function MarketDraftPanel({
  season,
  picks,
  lottery,
  totalPicks,
}: {
  season: string;
  picks: DraftHighlight[];
  lottery: LotteryHighlight[];
  totalPicks: number;
}) {
  if (picks.length === 0 && lottery.length === 0) return null;

  const draftYear = season.slice(0, 4);

  return (
    <section className="border border-rule bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-input/50 px-4 py-2.5">
        <h2 className="kicker text-text-muted">Draft et loterie {draftYear}</h2>
        <Link
          href={`/draft/${season}`}
          className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent transition-colors hover:text-accent-text"
        >
          {totalPicks > 0 ? `Voir les ${totalPicks} choix` : "Voir la draft"} →
        </Link>
      </header>

      <div className="grid divide-rule lg:grid-cols-2 lg:divide-x">
        {/* Premiers choix */}
        <div>
          <p className="border-b border-rule px-4 py-1.5 kicker text-text-faint">Premiers choix</p>
          {picks.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Draft non renseignée</p>
          ) : (
            <ul>
              {picks.map((pick) => (
                <li
                  key={pick.pick_overall}
                  className="flex items-center gap-3 border-b border-rule px-4 py-2 last:border-b-0"
                >
                  <span className="tnum w-5 font-mono text-xs font-bold text-text-primary">
                    {pick.pick_overall}
                  </span>
                  <img src={teamLogoUrl(pick.team_tricode)} alt="" className="h-5 w-5 object-contain" />
                  {pick.player_name === null ? (
                    <span className="text-sm italic text-text-faint">Choix non exercé</span>
                  ) : pick.player_id ? (
                    <Link
                      href={`/joueurs/${pick.player_id}`}
                      className="text-sm font-semibold text-text-primary underline decoration-rule underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
                    >
                      {pick.player_name}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-text-primary">{pick.player_name}</span>
                  )}
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-text-faint">
                    {teamNickname(pick.team_tricode)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Haut de la grille de loterie */}
        <div>
          <p className="border-b border-rule px-4 py-1.5 kicker text-text-faint">
            Loterie — meilleures chances
          </p>
          {lottery.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">
              Grille indisponible pour cette année
            </p>
          ) : (
            <>
              <ul>
                {lottery.map((row) => (
                  <li
                    key={row.team_tricode}
                    className="flex items-center gap-3 border-b border-rule px-4 py-2"
                  >
                    <span className="tnum w-5 font-mono text-xs font-bold text-text-primary">
                      {row.pre_lottery_rank}
                    </span>
                    <img src={teamLogoUrl(row.team_tricode)} alt="" className="h-5 w-5 object-contain" />
                    <span className="text-sm text-text-primary">{teamNickname(row.team_tricode)}</span>
                    {row.tied && (
                      <span
                        className="font-mono text-[10px] uppercase tracking-wider text-text-faint"
                        title="Bilan à égalité : la ligue départage par tirage au sort."
                      >
                        ex æquo
                      </span>
                    )}
                    <span className="tnum ml-auto font-mono text-[10px] text-text-faint">
                      {row.wins}–{row.losses}
                    </span>
                    <span className="tnum w-12 text-right font-mono text-xs font-bold text-text-primary">
                      {row.odds_top1 != null ? `${row.odds_top1} %` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="px-4 py-2 text-[11px] leading-relaxed text-text-faint">
                Chances d&apos;obtenir le premier choix avant tirage, d&apos;après le classement{" "}
                {seasonBefore(season)}. Les choix échangés ne sont pas identifiables.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
