"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { teamNickname } from "@/lib/nba-teams";
import TeamMark from "./TeamMark";

/**
 * Tableau des drafts, année par année.
 *
 * La ligne entière mène à sa draft. Le lien de l'année reste un vrai lien plutôt
 * qu'un simple gestionnaire de clic : c'est lui qui rend la ligne atteignable au
 * clavier et suivable par un moteur de recherche, là où un `onClick` seul
 * n'existerait que pour la souris.
 *
 * Le nom du joueur, lui, mène à sa fiche : son clic ne doit pas remonter jusqu'à
 * la ligne, sinon on n'y accéderait jamais.
 */

export interface DraftIndexRow {
  draftYear: number;
  season: string;
  teamTricode: string;
  playerName: string | null;
  playerId: number | null;
  college: string | null;
  pickCount: number;
  favourite: {
    teamTricode: string;
    wins: number | null;
    losses: number | null;
    oddsTop1: number | null;
  } | null;
}

export default function DraftIndexTable({ rows }: { rows: DraftIndexRow[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-rule bg-input/30 text-left">
            <th className="w-20 px-4 py-1.5 kicker text-text-faint">Draft</th>
            <th className="px-3 py-1.5 kicker text-text-faint">Premier pick</th>
            <th className="px-3 py-1.5 kicker text-text-faint">Par</th>
            <th className="px-3 py-1.5 kicker text-text-faint">Meilleures chances à la loterie</th>
            <th className="px-3 py-1.5 kicker text-text-faint text-right">Picks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.draftYear}
              onClick={() => router.push(`/draft/${row.season}`)}
              className="group cursor-pointer border-t border-rule transition-colors hover:bg-card-hover"
            >
              <td className="px-4 py-2">
                <Link
                  href={`/draft/${row.season}`}
                  className="tnum font-mono text-xs font-bold text-text-primary transition-colors group-hover:text-accent"
                >
                  {row.draftYear}
                </Link>
              </td>

              <td className="px-3 py-2">
                {row.playerId ? (
                  <Link
                    href={`/joueurs/${row.playerId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-semibold text-text-primary underline decoration-rule underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
                  >
                    {row.playerName}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-text-primary">
                    {row.playerName ?? "Pick non exercé"}
                  </span>
                )}
                {row.college && <span className="ml-2 text-[11px] text-text-faint">{row.college}</span>}
              </td>

              <td className="px-3 py-2">
                <span className="flex items-center gap-2">
                  <TeamMark tricode={row.teamTricode} />
                  <span className="text-sm text-text-muted">{teamNickname(row.teamTricode)}</span>
                </span>
              </td>

              <td className="px-3 py-2">
                {row.favourite ? (
                  <span className="flex items-center gap-2">
                    <TeamMark tricode={row.favourite.teamTricode} size={16} />
                    <span className="text-[11px] text-text-muted">
                      {teamNickname(row.favourite.teamTricode)}
                    </span>
                    <span className="tnum font-mono text-[10px] text-text-faint">
                      {row.favourite.wins}–{row.favourite.losses}
                      {row.favourite.oddsTop1 != null ? ` · ${row.favourite.oddsTop1} %` : ""}
                    </span>
                  </span>
                ) : (
                  <span className="text-[11px] italic text-text-faint">grille indisponible</span>
                )}
              </td>

              <td className="px-3 py-2 text-right">
                <span className="tnum font-mono text-xs text-text-muted group-hover:text-accent">
                  {row.pickCount}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
