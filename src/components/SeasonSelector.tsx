"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface SeasonSelectorProps {
  current: string;
  available: string[];
}

export default function SeasonSelector({ current, available }: SeasonSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const season = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (season === available[0]) {
      // Most recent season = default, remove param for clean URL
      params.delete("season");
    } else {
      params.set("season", season);
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={current}
        onChange={handleChange}
        className="appearance-none rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 pl-3 pr-8 py-1.5 text-sm font-medium text-white cursor-pointer outline-none hover:bg-white/25 transition-colors"
      >
        {available.map((s) => (
          <option key={s} value={s} className="bg-neutral-900 text-white">
            {s}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2 pointer-events-none text-white/70" />
    </div>
  );
}
