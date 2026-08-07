import { teamLogoUrl } from "@/lib/nba-teams";

/**
 * Logo d'équipe, ou son tricode quand il n'y en a pas.
 *
 * Les archives de draft remontent à 1950 et citent des franchises dissoutes —
 * Sheboygan, les Washington Capitols, les Chicago Stags — pour lesquelles la NBA
 * ne publie aucun logo. Une balise `img` sans source afficherait une image
 * cassée : le tricode est plus honnête et plus lisible.
 */
export default function TeamMark({
  tricode,
  size = 20,
}: {
  tricode: string;
  size?: number;
}) {
  const logo = teamLogoUrl(tricode);

  if (!logo) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center border border-rule font-mono text-[9px] font-bold uppercase tracking-tight text-text-faint"
        style={{ width: size, height: size }}
        title={tricode}
      >
        {tricode}
      </span>
    );
  }

  return (
    <img
      src={logo}
      alt=""
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
