import ScrollReveal from "./ScrollReveal";

export type BannerVariant =
  | "standings"
  | "calendar"
  | "teams"
  | "players"
  | "compare"
  | "stats"
  | "playoffs"
  | "injuries"
  | "articles"
  | "news"
  | "games";

interface PageBannerProps {
  title: string;
  subtitle: string;
  variant?: BannerVariant;
  image?: string;
  imagePosition?: string;
  extra?: React.ReactNode;
}

export default function PageBanner({
  title,
  subtitle,
  image,
  imagePosition,
  extra,
}: PageBannerProps) {
  const hasImage = !!image;

  return (
    <ScrollReveal variant="up">
      <div className="relative overflow-hidden border border-rule bg-card">
        {/* Background image — duotone treatment, no orbs */}
        {hasImage && (
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={image}
              alt=""
              loading="eager"
              className="h-full w-full object-cover grayscale"
              style={{ objectPosition: imagePosition || "center center" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/35" />
            {/* Scanline texture */}
            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0 1px, transparent 1px 4px)",
              }}
            />
          </div>
        )}

        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />

        {/* Content */}
        <div className="relative px-7 py-9 sm:px-10 sm:py-12">
          <p className={`kicker ${hasImage ? "text-white/70" : "text-accent-text"}`}>
            Hoopus · NBA
          </p>
          <h1
            className={`mt-3 font-display text-[clamp(2rem,6vw,4rem)] ${
              hasImage ? "text-white" : "text-text-primary"
            }`}
          >
            {title}
          </h1>
          <p
            className={`mt-3 max-w-2xl font-mono text-xs uppercase tracking-[0.14em] leading-relaxed ${
              hasImage ? "text-white/60" : "text-text-muted"
            }`}
          >
            {subtitle}
          </p>
          {extra && <div className="mt-4">{extra}</div>}
        </div>
      </div>
    </ScrollReveal>
  );
}
