import Link from "next/link";
import {
  Newspaper,
  FileText,
  BarChart3,
  Calendar,
  Users,
  UserRound,
  Trophy,
  Gamepad2,
  ArrowRight,
  Flame,
  Sparkles,
  Clock,
  BookOpen,
} from "lucide-react";
import { getArticles } from "@/lib/actions/articles";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonWidget from "@/components/SeasonWidget";
import FavoriteDashboard from "@/components/FavoriteDashboard";
import FavoriteAlerts from "@/components/FavoriteAlerts";

/* ── Fun facts ───────────────────────────── */
const funFacts = [
  "Wilt Chamberlain a inscrit 100 points en un seul match le 2 mars 1962. Le deuxième record est de 81, par Kobe, 44 ans plus tard.",
  "Scott Skiles détient le record de passes en un match : 30. Ce soir-là, ses coéquipiers n'avaient plus qu'à finir.",
  "Muggsy Bogues, 1m60, a contré Patrick Ewing, 2m13. L'écart de taille le plus absurde sur un contre en NBA.",
  "Dennis Rodman n'a jamais dépassé les 11.6 points de moyenne. Il a pourtant été élu au Hall of Fame.",
  "Nikola Jokic, drafté en 41e position en 2013, est devenu triple MVP. Denver l'a sélectionné pendant une pub Taco Bell.",
  "En 1996, les Bulls de Jordan ont terminé à 72-10. Personne n'a pensé que c'était battable. Les Warriors de 2016 ont fait 73-9.",
  "Russell Westbrook a réalisé un triple-double de moyenne sur une saison entière. Puis il l'a refait. Et encore une fois.",
  "Le game 7 des Finals 2016 entre Cleveland et Golden State reste le match le plus regardé de l'histoire de la NBA : 31 millions de téléspectateurs.",
  "Hakeem Olajuwon est le seul joueur à avoir remporté le titre MVP, le DPOY et le titre NBA la même saison, en 1994.",
  "Le premier match NBA de l'histoire s'est joué le 1er novembre 1946. Les New York Knicks ont battu les Toronto Huskies 68-66.",
];

/*
 * Bento grid — 4 cols desktop, 2 tablet, 1 mobile.
 * Sizes: xl (2×2), md (2×1), sm (1×1), banner (4×1).
 * Order = visual priority the user asked for.
 */
const categories = [
  // ── Row 1-2: hero cards ──
  {
    href: "/playoffs",
    title: "Playoffs",
    tagline: "Win or go home",
    description: "Brackets, séries, play-in -- suivez chaque match décisif de l'après-saison.",
    icon: <Trophy size={22} strokeWidth={1.5} />,
    iconBg: <Trophy size={80} strokeWidth={0.7} />,
    color: "#1e3a4a",
    size: "xl" as const,
    cell: "sm:col-span-2 sm:row-span-2",
  },
  {
    href: "/calendrier",
    title: "Calendrier",
    tagline: "Ne ratez rien",
    description: "Tous les matchs, scores et horaires -- hier, aujourd'hui et demain.",
    icon: <Calendar size={22} strokeWidth={1.5} />,
    iconBg: <Calendar size={80} strokeWidth={0.7} />,
    color: "#2a2d4a",
    size: "xl" as const,
    cell: "sm:col-span-2 sm:row-span-2",
  },
  // ── Row 3: medium cards ──
  {
    href: "/classement",
    title: "Classement",
    tagline: "La course aux playoffs, conférence par conférence",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="10" width="6" height="11" rx="1" />
        <rect x="9" y="4" width="6" height="17" rx="1" />
        <rect x="16" y="14" width="6" height="7" rx="1" />
      </svg>
    ),
    iconBg: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="10" width="6" height="11" rx="1" />
        <rect x="9" y="4" width="6" height="17" rx="1" />
        <rect x="16" y="14" width="6" height="7" rx="1" />
      </svg>
    ),
    color: "#3a3225",
    size: "md" as const,
    cell: "sm:col-span-2",
  },
  {
    href: "/mini-jeux",
    title: "Mini-jeux",
    tagline: "7 jeux quotidiens pour tester vos connaissances",
    icon: <Gamepad2 size={20} strokeWidth={1.5} />,
    iconBg: <Gamepad2 size={56} strokeWidth={0.7} />,
    color: "#3a2535",
    size: "md" as const,
    cell: "sm:col-span-2",
  },
  // ── Row 4: small tiles ──
  {
    href: "/joueurs",
    title: "Joueurs",
    tagline: "Profils et carrières",
    icon: <UserRound size={18} strokeWidth={1.5} />,
    iconBg: <UserRound size={48} strokeWidth={0.8} />,
    color: "#2a2d4a",
    size: "sm" as const,
    cell: "",
  },
  {
    href: "/equipes",
    title: "Équipes",
    tagline: "30 franchises",
    icon: <Users size={18} strokeWidth={1.5} />,
    iconBg: <Users size={48} strokeWidth={0.8} />,
    color: "#1e3a4a",
    size: "sm" as const,
    cell: "",
  },
  {
    href: "/statistiques",
    title: "Statistiques",
    tagline: "Les chiffres parlent",
    icon: <BarChart3 size={18} strokeWidth={1.5} />,
    iconBg: <BarChart3 size={48} strokeWidth={0.8} />,
    color: "#1e3a30",
    size: "sm" as const,
    cell: "",
  },
  {
    href: "/articles",
    title: "Articles",
    tagline: "Analyses",
    icon: <FileText size={18} strokeWidth={1.5} />,
    iconBg: <FileText size={48} strokeWidth={0.8} />,
    color: "#3a3225",
    size: "sm" as const,
    cell: "",
  },
  // ── Row 5: full-width banner ──
  {
    href: "/actualites",
    title: "Actualités",
    tagline: "Trades, drama, buzzer beaters -- tout ce qui fait vibrer la ligue",
    icon: <Newspaper size={18} strokeWidth={1.5} />,
    iconBg: <Newspaper size={48} strokeWidth={0.8} />,
    color: "#3a2535",
    size: "banner" as const,
    cell: "sm:col-span-4",
  },
];

function getDaily<T>(arr: T[]): T {
  const day = Math.floor(Date.now() / 86_400_000);
  return arr[day % arr.length];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function Home() {
  const season = getCurrentSeason();
  const articles = await getArticles();
  const featured = articles[0] ?? null;
  const funFact = getDaily(funFacts);

  return (
    <div className="mx-auto max-w-6xl space-y-8 sm:space-y-14">
      {/* ── Favorite Alerts ──────────────────── */}
      <FavoriteAlerts />

      {/* ── Hero with background image ───────── */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border-t">
        {/* Background photo */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1640862101983-9f7ef7fd7cc9?w=1400&q=80"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        </div>

        <div className="relative px-5 py-10 sm:px-12 sm:py-20">
          <div className="max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              {seasonLabel(season)} en cours
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Bienvenue sur{" "}
              <span className="bg-gradient-to-r from-accent to-accent-hover bg-clip-text text-transparent">
                Hoopus
              </span>
            </h1>

            <p className="text-lg leading-relaxed text-white/70">
              Toute la NBA, distillée pour les vrais passionnés.
              <br className="hidden sm:block" />
              Actu, stats, classements, rosters et playoffs — tout est là.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/actualites"
                className="group inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/25 hover:scale-[1.03] active:scale-[0.98]"
              >
                <Flame size={16} strokeWidth={1.5} />
                Voir les actus
                <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/statistiques"
                className="group inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:scale-[1.03] active:scale-[0.98]"
              >
                <BarChart3 size={16} strokeWidth={1.5} />
                Plonger dans les stats
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── En ce moment ────────────────────── */}
      <ScrollReveal variant="scale">
        <SeasonWidget />
      </ScrollReveal>

      {/* ── Article à la une ─────────────────── */}
      {featured && (
        <ScrollReveal variant="scale">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-text-primary">À la une</h2>
            <Link
              href="/articles"
              className="group flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
            >
              Tous les articles
              <ArrowRight size={14} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>

          <Link
            href={`/articles/${featured.id}`}
            className="group relative block overflow-hidden rounded-2xl border border-border-t bg-card transition-all duration-300 hover:border-border-hover hover:shadow-xl"
          >
            <div className="flex flex-col lg:flex-row">
              {featured.image_url ? (
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-input lg:aspect-auto lg:w-1/2">
                  <img
                    src={featured.image_url}
                    alt={featured.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent lg:bg-gradient-to-r" />
                </div>
              ) : (
                <div className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden lg:aspect-auto lg:w-1/2">
                  <img
                    src="https://images.unsplash.com/photo-1529243856184-fd5465488984?w=800&q=80"
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-black/10" />
                </div>
              )}

              <div className="flex flex-1 flex-col justify-center p-5 sm:p-8 lg:p-10">
                <span className="inline-block w-fit rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-text">
                  {featured.tag}
                </span>
                <h3 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-bold leading-snug text-text-primary transition-colors group-hover:text-accent-text lg:text-3xl">
                  {featured.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-text-secondary line-clamp-3">
                  {featured.excerpt}
                </p>
                <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-text-muted">
                  <span className="font-medium text-text-secondary">{featured.author}</span>
                  <span className="flex items-center gap-1">
                    <BookOpen size={14} strokeWidth={1.5} />
                    {featured.read_time}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} strokeWidth={1.5} />
                    {formatDate(featured.created_at)}
                  </span>
                </div>
                <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-accent opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                  Lire l&apos;article
                  <ArrowRight size={14} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>
        </ScrollReveal>
      )}

      {/* ── Mon espace (favoris) ───────────── */}
      <ScrollReveal variant="up">
        <FavoriteDashboard />
      </ScrollReveal>

      {/* ── Bento Categories ────────────────────── */}
      <section>
        <ScrollReveal variant="left">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-text-primary">Explorez la ligue</h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat, i) => {
            const isXl = cat.size === "xl";
            const isMd = cat.size === "md";
            const isBanner = cat.size === "banner";
            const minH = isXl ? "min-h-[240px]" : isMd ? "min-h-[110px]" : isBanner ? "min-h-[64px]" : "min-h-[100px]";

            return (
              <ScrollReveal key={cat.href} delay={i * 50} variant="scale" className={cat.cell}>
                <Link
                  href={cat.href}
                  className={`group relative flex h-full overflow-hidden rounded-2xl border border-border-t bg-card transition-all duration-300 hover:-translate-y-1 active:translate-y-0 ${minH}`}
                  style={{
                    // @ts-expect-error CSS custom property
                    "--cat-color": cat.color,
                  }}
                >
                  {/* Colored background */}
                  <div
                    className="absolute inset-0 transition-opacity duration-500 opacity-95 group-hover:opacity-100"
                    style={{ background: `linear-gradient(160deg, ${cat.color} 0%, ${cat.color}cc 50%, ${cat.color}80 100%)` }}
                  />
                  {/* Dark vignette for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />

                  {/* Shine sweep on hover */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[shine_0.7s_ease-out_forwards]" />
                  </div>

                  {/* Background icon watermark */}
                  <div
                    className={`absolute text-white/[0.08] transition-all duration-500 group-hover:text-white/[0.15] group-hover:scale-110 ${
                      isBanner ? "right-5 top-1/2 -translate-y-1/2" : "right-4 bottom-4"
                    }`}
                  >
                    {cat.iconBg}
                  </div>

                  {/* Content */}
                  <div className={`relative flex w-full ${
                    isBanner
                      ? "flex-row items-center gap-4 px-5 py-3"
                      : "flex-col justify-end p-5"
                  } ${isXl ? "gap-3" : isMd ? "gap-1.5" : "gap-1"}`}>
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 text-white/90 transition-transform duration-300 group-hover:scale-110">
                        {cat.icon}
                      </span>
                      {isBanner && (
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-white">{cat.title}</span>
                          <span className="hidden sm:inline text-sm text-white/60 ml-2">{cat.tagline}</span>
                        </div>
                      )}
                    </div>
                    {!isBanner && (
                      <>
                        <h3 className={`font-bold text-white ${isXl ? "text-xl" : isMd ? "text-base" : "text-sm"}`}>
                          {cat.title}
                        </h3>
                        {isXl && cat.description ? (
                          <p className="text-sm leading-relaxed text-white/65 max-w-sm">{cat.description}</p>
                        ) : (
                          <p className={`text-white/50 ${isMd ? "text-sm" : "text-xs"}`}>{cat.tagline}</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Arrow */}
                  <div
                    className={`absolute opacity-0 translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 ${
                      isBanner ? "right-5 top-1/2 -translate-y-1/2" : "top-4 right-4"
                    }`}
                  >
                    <ArrowRight size={16} strokeWidth={1.5} className="text-white/80" />
                  </div>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* ── Le saviez-vous ───────────────────── */}
      <ScrollReveal variant="right">
        <section className="relative overflow-hidden rounded-2xl border border-accent/15 bg-gradient-to-r from-accent/8 via-card to-card p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-light">
              <Sparkles size={18} strokeWidth={1.5} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-accent-text">
                Le saviez-vous ?
              </h3>
              <p className="mt-1.5 text-base leading-relaxed text-text-secondary">
                {funFact}
              </p>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── Bottom CTA with photo ────────────── */}
      <ScrollReveal variant="blur">
        <section className="relative overflow-hidden rounded-2xl border border-border-t">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1659468711279-2857db123912?w=1200&q=80"
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/30" />
          </div>
          <div className="relative flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-10">
            <div>
              <h3 className="text-xl font-bold text-white">
                On joue ce soir ?
              </h3>
              <p className="mt-1.5 text-sm text-white/60">
                Consultez le calendrier et ne ratez aucun tip-off.
              </p>
            </div>
            <Link
              href="/calendrier"
              className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/25 hover:scale-[1.03] active:scale-[0.98]"
            >
              <Calendar size={16} strokeWidth={1.5} />
              Matchs du jour
              <ArrowRight size={14} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </ScrollReveal>

      {/* ── Footer ───────────────────────────── */}
      <ScrollReveal variant="up">
        <p className="pb-4 text-center text-xs text-text-faint">
          Fait par des passionnés, pour des passionnés.
        </p>
      </ScrollReveal>
    </div>
  );
}
