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
    <ScrollReveal variant="scale">
      <div className="relative overflow-hidden rounded-2xl border border-border-t bg-card">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          {hasImage ? (
            <>
              <img
                src={image}
                alt=""
                loading="eager"
                className="h-full w-full object-cover"
                style={{ objectPosition: imagePosition || "center center" }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/30" />
            </>
          ) : (
            <>
              {/* Subtle depth gradient */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to bottom right, var(--bg-card), var(--bg-card-hover))",
                }}
              />

              {/* Primary accent glow — top right */}
              <div
                data-banner-orb=""
                className="absolute -top-24 -right-24 h-72 w-72 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
                  opacity: 0.12,
                  animation: "banner-drift-1 20s ease-in-out infinite",
                  willChange: "transform",
                }}
              />

              {/* Secondary accent glow — bottom left */}
              <div
                data-banner-orb=""
                className="absolute -bottom-36 -left-20 h-80 w-80 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
                  opacity: 0.07,
                  animation: "banner-drift-2 25s ease-in-out infinite",
                  willChange: "transform",
                }}
              />

              {/* Diagonal accent wash */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent-light) 0%, transparent 50%)",
                }}
              />
            </>
          )}
        </div>

        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{
            background:
              "linear-gradient(to bottom, var(--accent), var(--accent) 40%, transparent)",
          }}
        />

        {/* Bottom accent line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(to right, var(--accent), transparent 60%)",
          }}
        />

        {/* Content */}
        <div className="relative px-8 py-10 sm:px-10 sm:py-12">
          <h1
            className={`text-3xl font-bold tracking-tight sm:text-4xl ${
              hasImage ? "text-white" : "text-text-primary"
            }`}
          >
            {title}
          </h1>
          <p
            className={`mt-2 text-sm sm:text-base ${
              hasImage ? "text-white/60" : "text-text-muted"
            }`}
          >
            {subtitle}
          </p>
          {extra && <div className="mt-3">{extra}</div>}
        </div>
      </div>
    </ScrollReveal>
  );
}
