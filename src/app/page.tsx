import Link from "next/link";
import {
  Newspaper,
  FileText,
  BarChart3,
  Calendar,
  Users,
  Trophy,
  ArrowRight,
  Flame,
  Sparkles,
  Clock,
  BookOpen,
} from "lucide-react";
import { getArticles } from "@/lib/actions/articles";
import ScrollReveal from "@/components/ScrollReveal";

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

const categories = [
  {
    href: "/actualites",
    title: "Actualités",
    description: "Trades, drama, buzzer beaters — tout ce qui fait vibrer la ligue",
    icon: <Newspaper size={20} />,
    color: "#f97316",
    image: "https://images.unsplash.com/photo-1527261834078-9b37d35a4a32?w=600&q=80",
  },
  {
    href: "/articles",
    title: "Articles",
    description: "On décortique les matchs, les tactiques et les tendances",
    icon: <FileText size={20} />,
    color: "#3b82f6",
    image: "https://images.unsplash.com/photo-1549210194-fb0aac030c32?w=600&q=80",
  },
  {
    href: "/statistiques",
    title: "Statistiques",
    description: "PTS, AST, REB, FG% — le paradis des amoureux des chiffres",
    icon: <BarChart3 size={20} />,
    color: "#10b981",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
  },
  {
    href: "/calendrier",
    title: "Calendrier",
    description: "Qui joue ce soir, qui a gagné hier, qui joue demain",
    icon: <Calendar size={20} />,
    color: "#8b5cf6",
    image: "https://images.unsplash.com/photo-1693164586646-f3f877aec626?w=600&q=80",
  },
  {
    href: "/classement",
    title: "Classement",
    description: "La course aux playoffs, conférence par conférence",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="10" width="6" height="11" rx="1" />
        <rect x="9" y="4" width="6" height="17" rx="1" />
        <rect x="16" y="14" width="6" height="7" rx="1" />
      </svg>
    ),
    color: "#eab308",
    image: "https://images.unsplash.com/photo-1578269174936-2709b6aeb913?w=600&q=80",
  },
  {
    href: "/equipes",
    title: "Équipes",
    description: "30 franchises, leurs rosters et leurs salary caps",
    icon: <Users size={20} />,
    color: "#ec4899",
    image: "https://images.unsplash.com/photo-1759694705159-fad2c93938f1?w=600&q=80",
  },
  {
    href: "/playoffs",
    title: "Playoffs",
    description: "Là où les légendes se forgent. Win or go home.",
    icon: <Trophy size={20} />,
    color: "#06b6d4",
    image: "https://images.unsplash.com/photo-1579487685737-e435a87b2518?w=600&q=80",
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
  const articles = await getArticles();
  const featured = articles[0] ?? null;
  const funFact = getDaily(funFacts);

  return (
    <div className="mx-auto max-w-6xl space-y-14">
      {/* ── Hero with background image ───────── */}
      <section className="relative overflow-hidden rounded-3xl border border-border-t">
        {/* Background photo */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1640862101983-9f7ef7fd7cc9?w=1400&q=80"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        </div>

        <div className="relative px-8 py-14 sm:px-12 sm:py-20">
          <div className="max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Saison 2025-26 en cours
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
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
                <Flame size={16} />
                Voir les actus
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/statistiques"
                className="group inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20 hover:scale-[1.03] active:scale-[0.98]"
              >
                <BarChart3 size={16} />
                Plonger dans les stats
              </Link>
            </div>
          </div>
        </div>
      </section>

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
              <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>

          <Link
            href="/articles"
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

              <div className="flex flex-1 flex-col justify-center p-8 lg:p-10">
                <span className="inline-block w-fit rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-text">
                  {featured.tag}
                </span>
                <h3 className="mt-4 text-2xl font-bold leading-snug text-text-primary transition-colors group-hover:text-accent-text sm:text-3xl">
                  {featured.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-text-secondary line-clamp-3">
                  {featured.excerpt}
                </p>
                <div className="mt-6 flex items-center gap-4 text-sm text-text-muted">
                  <span className="font-medium text-text-secondary">{featured.author}</span>
                  <span className="flex items-center gap-1">
                    <BookOpen size={14} />
                    {featured.read_time}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {formatDate(featured.created_at)}
                  </span>
                </div>
                <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-accent opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                  Lire l&apos;article
                  <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>
        </ScrollReveal>
      )}

      {/* ── Categories Grid ──────────────────── */}
      <section>
        <ScrollReveal variant="left">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text-primary">Explorez la ligue</h2>
            <p className="mt-1 text-sm text-text-muted">
              Sept rubriques, zéro excuse pour rater quoi que ce soit.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => (
            <ScrollReveal key={cat.href} delay={i * 80} variant={i % 2 === 0 ? "up" : "blur"}>
              <Link
                href={cat.href}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border-t bg-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
              >
                {/* Photo header */}
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={cat.image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  {/* Icon badge */}
                  <div
                    className="absolute bottom-3 left-4 flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-lg transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: cat.color }}
                  >
                    {cat.icon}
                  </div>
                </div>

                {/* Content */}
                <div className="relative flex flex-1 flex-col px-5 pb-5 pt-4">
                  <h3 className="text-lg font-bold text-text-primary">{cat.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{cat.description}</p>

                  <div
                    className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold opacity-0 transition-all duration-300 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0"
                    style={{ color: cat.color }}
                  >
                    Consulter
                    <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ── Le saviez-vous ───────────────────── */}
      <ScrollReveal variant="right">
        <section className="relative overflow-hidden rounded-2xl border border-accent/15 bg-gradient-to-r from-accent/8 via-card to-card p-7 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-light">
              <Sparkles size={20} className="text-accent" />
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
          <div className="relative flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
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
              <Calendar size={16} />
              Matchs du jour
              <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
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
