"use client";

import { RotateCw, TriangleAlert } from "lucide-react";

/**
 * Lecture des statistiques interrompue.
 *
 * La page préfère échouer plutôt que d'afficher une saison incomplète, ou de la
 * déclarer « pas encore synchronisée » alors que la base a simplement tardé à
 * répondre. L'incident est passager : un nouvel essai suffit presque toujours.
 */
export default function StatistiquesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="border border-rule bg-card px-6 py-12 text-center">
        <TriangleAlert size={26} strokeWidth={1.75} className="mx-auto text-text-faint" />

        <h2 className="mt-4 font-display text-xl uppercase leading-none text-text-primary sm:text-2xl">
          Les statistiques n&apos;ont pas pu être chargées
        </h2>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-muted">
          La base de données a mis trop de temps à répondre. Les chiffres sont bien là : un nouvel
          essai suffit en général.
        </p>

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={reset}
            className="group inline-flex items-center gap-1.5 border border-rule px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary"
          >
            <RotateCw
              size={12}
              strokeWidth={2}
              className="transition-transform duration-300 group-hover:rotate-90"
            />
            Réessayer
          </button>
        </div>
      </div>
    </div>
  );
}
