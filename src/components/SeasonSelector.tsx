"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createContext, useContext, useTransition, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Shared transition context
const SeasonPendingCtx = createContext<{
  isPending: boolean;
  startTransition: (cb: () => void) => void;
}>({ isPending: false, startTransition: (cb) => cb() });

export function SeasonTransitionProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  return (
    <SeasonPendingCtx.Provider value={{ isPending, startTransition }}>
      {children}
    </SeasonPendingCtx.Provider>
  );
}

export function SeasonContent({ children }: { children: ReactNode }) {
  const { isPending } = useContext(SeasonPendingCtx);
  return (
    <div
      className="transition-all duration-300 ease-in-out"
      style={{
        opacity: isPending ? 0.4 : 1,
        filter: isPending ? "blur(4px)" : "none",
        pointerEvents: isPending ? "none" : "auto",
      }}
    >
      {children}
    </div>
  );
}

interface SeasonSelectorProps {
  current: string;
  available: string[];
  /**
   * Saison affichée quand l'URL ne précise rien. La sélectionner retire le
   * paramètre plutôt que de l'inscrire.
   *
   * À renseigner dès que le premier élément de `available` n'est pas le défaut
   * de la page : les listes incluent la saison à venir, alors que les pages de
   * statistiques s'ouvrent par défaut sur la dernière saison jouée. Sans cette
   * précision, choisir la saison à venir renverrait sur une autre.
   */
  defaultSeason?: string;
  /** Statut par saison, affiché à côté du libellé (« à venir », « terminée »). */
  statuses?: Record<string, string>;
}

export default function SeasonSelector({
  current,
  available,
  defaultSeason,
  statuses,
}: SeasonSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startTransition } = useContext(SeasonPendingCtx);
  const fallbackSeason = defaultSeason ?? available[0];

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const season = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (season === fallbackSeason) {
      params.delete("season");
    } else {
      params.set("season", season);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    });
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={current}
        onChange={handleChange}
        className="tnum appearance-none border border-border-hover bg-input pl-3 pr-8 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-text-primary cursor-pointer outline-none transition-colors hover:bg-card-hover focus:border-accent"
      >
        {available.map((s) => {
          const status = statuses?.[s];
          return (
            <option key={s} value={s} className="bg-card text-text-primary">
              {status ? `${s} · ${status}` : s}
            </option>
          );
        })}
      </select>
      <ChevronDown size={14} className="absolute right-2 pointer-events-none text-text-muted" />
    </div>
  );
}
