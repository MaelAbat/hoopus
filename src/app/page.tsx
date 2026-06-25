import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getArticles } from "@/lib/actions/articles";
import { hasNews } from "@/lib/actions/news";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import ScrollReveal from "@/components/ScrollReveal";
import SeasonWidget from "@/components/SeasonWidget";
import FavoriteDashboard from "@/components/FavoriteDashboard";
import FavoriteAlerts from "@/components/FavoriteAlerts";

// Home keeps the root layout's default title/description; only pins its canonical.
export const metadata = {
  alternates: { canonical: "/" },
};

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
 * Sommaire — rundown de régie. Chaque rubrique est une ligne numérotée
 * pleine largeur ; le survol remplit la ligne en accent. Zéro carte bento.
 */
const sections = [
  { href: "/calendrier", title: "Calendrier", tagline: "Tous les matchs, scores et horaires" },
  { href: "/classement", title: "Classement", tagline: "La course aux playoffs, conférence par conférence" },
  { href: "/statistiques", title: "Statistiques", tagline: "Leaders, moyennes, classements" },
  { href: "/joueurs", title: "Joueurs", tagline: "Profils et carrières" },
  { href: "/equipes", title: "Équipes", tagline: "Les 30 franchises" },
  { href: "/playoffs", title: "Playoffs", tagline: "Brackets, séries, play-in" },
  { href: "/blessures", title: "Infirmerie", tagline: "Le rapport blessures du jour" },
  { href: "/mini-jeux", title: "Mini-jeux", tagline: "7 défis quotidiens" },
  { href: "/articles", title: "Articles", tagline: "Analyses au long format" },
  { href: "/actualites", title: "Actualités", tagline: "Trades, drama, buzzer beaters" },
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
  const [articles, newsExists] = await Promise.all([getArticles(), hasNews()]);
  const featured = articles[0] ?? null;
  const funFact = getDaily(funFacts);

  const articlesExist = articles.length > 0;
  const visibleSections = sections.filter((s) => {
    if (s.href === "/articles") return articlesExist;
    if (s.href === "/actualites") return newsExists;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Favorite Alerts ──────────────────── */}
      <FavoriteAlerts />

      {/* ── Masthead ─────────────────────────── */}
      <section className="relative overflow-hidden border border-rule bg-card">
        {/* Basketball seam line-art, bleeding off the right edge */}
        <svg
          viewBox="0 0 200 200"
          aria-hidden
          className="pointer-events-none absolute -right-20 -bottom-24 hidden h-[440px] w-[440px] text-accent opacity-[0.07] lg:block"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="100" cy="100" r="96" />
          <line x1="100" y1="4" x2="100" y2="196" />
          <line x1="4" y1="100" x2="196" y2="100" />
          <path d="M34 32 Q104 100 34 168" />
          <path d="M166 32 Q96 100 166 168" />
        </svg>

        {/* Top status rail */}
        <div className="flex items-center justify-between border-b border-rule px-5 py-2.5 sm:px-8">
          <span className="kicker text-text-muted">Saison {seasonLabel(season)}</span>
          <span className="inline-flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="kicker text-accent-text">En direct</span>
          </span>
        </div>

        <div className="relative px-5 py-10 sm:px-8 sm:py-16">
          <h1 className="font-display text-text-primary text-[clamp(2.75rem,9vw,7rem)]">
            Toute la NBA.
            <br />
            En français<span className="text-accent">.</span>
          </h1>

          <div className="mt-6 h-[2px] w-24 bg-accent" />

          <p className="mt-6 max-w-xl font-mono text-xs uppercase tracking-[0.18em] leading-relaxed text-text-secondary">
            Scores · Stats · Classements · Rosters · Playoffs
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {newsExists ? (
              <Link
                href="/actualites"
                className="group inline-flex items-center gap-2.5 bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
              >
                Voir les actus
                <ArrowRight size={15} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            ) : (
              <Link
                href="/calendrier"
                className="group inline-flex items-center gap-2.5 bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
              >
                Matchs du jour
                <ArrowRight size={15} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            )}
            <Link
              href="/statistiques"
              className="inline-flex items-center gap-2.5 border border-border-hover px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-text-primary transition-colors hover:bg-input"
            >
              Plonger dans les stats
            </Link>
          </div>
        </div>
      </section>

      {/* ── En ce moment ────────────────────── */}
      <div className="mt-10 sm:mt-16">
        <SectionLabel index="00" title="En ce moment" />
        <ScrollReveal variant="up">
          <SeasonWidget />
        </ScrollReveal>
      </div>

      {/* ── À la une ─────────────────────────── */}
      {featured && (
        <div className="mt-10 sm:mt-16">
          <div className="flex items-end justify-between">
            <SectionLabel index="" title="À la une" />
            <Link
              href="/articles"
              className="group mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent-text transition-colors hover:text-accent"
            >
              Tous les articles
              <ArrowRight size={13} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>

          <ScrollReveal variant="up">
            <Link
              href={`/articles/${featured.id}`}
              className="group grid grid-cols-1 overflow-hidden border border-rule bg-card transition-colors hover:border-border-hover lg:grid-cols-2"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-input lg:aspect-auto">
                <img
                  src={featured.image_url || "https://images.unsplash.com/photo-1529243856184-fd5465488984?w=800&q=80"}
                  alt={featured.title}
                  className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent mix-blend-multiply" />
                <span className="absolute left-0 top-0 bg-accent px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
                  {featured.tag}
                </span>
              </div>

              <div className="flex flex-col justify-center p-6 sm:p-10">
                <h3 className="font-display text-2xl leading-[1.02] text-text-primary transition-colors group-hover:text-accent-text sm:text-4xl">
                  {featured.title}
                </h3>
                <p className="mt-4 leading-relaxed text-text-secondary line-clamp-3">
                  {featured.excerpt}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule pt-4 font-mono text-[11px] uppercase tracking-wider text-text-muted">
                  <span className="font-semibold text-text-secondary">{featured.author}</span>
                  <span>{featured.read_time}</span>
                  <span>{formatDate(featured.created_at)}</span>
                </div>
              </div>
            </Link>
          </ScrollReveal>
        </div>
      )}

      {/* ── Mon espace (favoris) ───────────── */}
      <div className="mt-10 sm:mt-16">
        <ScrollReveal variant="up">
          <FavoriteDashboard />
        </ScrollReveal>
      </div>

      {/* ── Sommaire (rundown) ───────────────── */}
      <section className="mt-10 sm:mt-16">
        <SectionLabel index="" title="Le sommaire" />
        <div className="border-t border-rule">
          {visibleSections.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className="group relative flex items-center gap-4 border-b border-rule py-5 transition-colors duration-200 hover:bg-accent sm:gap-7 sm:py-6"
            >
              <span className="w-7 shrink-0 font-mono text-sm tabular-nums text-text-faint transition-colors group-hover:text-white/70 sm:w-10 sm:text-base">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-2xl leading-none text-text-primary transition-colors group-hover:text-white sm:text-4xl">
                  {s.title}
                </h3>
                <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-text-muted transition-colors group-hover:text-white/70">
                  {s.tagline}
                </p>
              </div>
              <ArrowUpRight
                size={22}
                strokeWidth={1.75}
                className="shrink-0 text-text-faint transition-all duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-white"
              />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Data point (le saviez-vous) ──────── */}
      <ScrollReveal variant="up">
        <section className="mt-10 flex items-start gap-5 border border-rule bg-card p-6 sm:mt-16 sm:gap-7 sm:p-8">
          <span className="font-display text-5xl leading-none text-accent sm:text-7xl">#</span>
          <div className="min-w-0">
            <p className="kicker text-accent-text">Le saviez-vous</p>
            <p className="mt-2 text-base leading-relaxed text-text-secondary sm:text-lg">
              {funFact}
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* ── Bottom CTA ───────────────────────── */}
      <section className="relative mt-10 flex flex-col items-start gap-5 overflow-hidden border border-rule bg-accent p-6 sm:mt-16 sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div>
          <p className="kicker text-white/70">Ce soir</p>
          <h3 className="mt-1 font-display text-3xl text-white sm:text-5xl">
            On joue ce soir ?
          </h3>
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-white/80">
            Consultez le calendrier et ne ratez aucun tip-off.
          </p>
        </div>
        <Link
          href="/calendrier"
          className="group inline-flex shrink-0 items-center gap-2.5 border border-white/40 bg-black/10 px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-black/25"
        >
          Matchs du jour
          <ArrowRight size={15} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </section>

      {/* ── Footer colophon ──────────────────── */}
      <div className="mt-10 flex items-center justify-between border-t border-rule py-6 sm:mt-16">
        <span className="font-display text-lg tracking-tight text-text-primary">
          HOOP<span className="text-accent">US</span>
        </span>
        <p className="kicker text-text-faint">Par des passionnés · pour des passionnés</p>
      </div>
    </div>
  );
}

function SectionLabel({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-3">
      {index && <span className="font-mono text-sm tabular-nums text-text-faint">{index}</span>}
      <h2 className="font-display text-2xl text-text-primary sm:text-3xl">{title}</h2>
    </div>
  );
}
