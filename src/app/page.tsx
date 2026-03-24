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

/* ── Fun facts stats & histoires ─────────── */
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
    icon: <Newspaper size={24} />,
    gradient: "from-orange-500/20 to-amber-500/10",
    iconBg: "bg-orange-500/15 text-orange-400",
  },
  {
    href: "/articles",
    title: "Articles",
    description: "On décortique les matchs, les tactiques et les tendances",
    icon: <FileText size={24} />,
    gradient: "from-blue-500/20 to-cyan-500/10",
    iconBg: "bg-blue-500/15 text-blue-400",
  },
  {
    href: "/statistiques",
    title: "Statistiques",
    description: "PTS, AST, REB, FG% — le paradis des amoureux des chiffres",
    icon: <BarChart3 size={24} />,
    gradient: "from-emerald-500/20 to-green-500/10",
    iconBg: "bg-emerald-500/15 text-emerald-400",
  },
  {
    href: "/calendrier",
    title: "Calendrier",
    description: "Qui joue ce soir, qui a gagné hier, qui joue demain",
    icon: <Calendar size={24} />,
    gradient: "from-violet-500/20 to-purple-500/10",
    iconBg: "bg-violet-500/15 text-violet-400",
  },
  {
    href: "/classement",
    title: "Classement",
    description: "La course aux playoffs, conférence par conférence",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="10" width="6" height="11" rx="1" />
        <rect x="9" y="4" width="6" height="17" rx="1" />
        <rect x="16" y="14" width="6" height="7" rx="1" />
      </svg>
    ),
    gradient: "from-yellow-500/20 to-orange-500/10",
    iconBg: "bg-yellow-500/15 text-yellow-400",
  },
  {
    href: "/equipes",
    title: "Équipes",
    description: "30 franchises, leurs rosters et leurs salary caps",
    icon: <Users size={24} />,
    gradient: "from-pink-500/20 to-rose-500/10",
    iconBg: "bg-pink-500/15 text-pink-400",
  },
  {
    href: "/playoffs",
    title: "Playoffs",
    description: "Là où les légendes se forgent. Win or go home.",
    icon: <Trophy size={24} />,
    gradient: "from-cyan-500/20 to-teal-500/10",
    iconBg: "bg-cyan-500/15 text-cyan-400",
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
      {/* ── Hero ──────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-border-t bg-card">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/8 blur-3xl animate-float" />
          <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-accent/6 blur-3xl animate-float-delayed" />
          <div className="absolute left-1/3 top-1/4 h-32 w-32 rounded-full bg-accent/4 blur-2xl animate-float" />
        </div>

        <div className="relative px-8 py-12 sm:px-12 sm:py-16">
          <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-light px-4 py-1.5 text-xs font-semibold text-accent-text">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Saison 2025-26 en cours
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
                Bienvenue sur{" "}
                <span className="bg-gradient-to-r from-accent to-accent-hover bg-clip-text text-transparent">
                  Hoopus
                </span>
              </h1>

              <p className="text-lg leading-relaxed text-text-secondary">
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
                  className="group inline-flex items-center gap-2 rounded-xl border border-border-t bg-input px-6 py-3 text-sm font-bold text-text-primary transition-all duration-300 hover:border-border-hover hover:bg-card-hover hover:scale-[1.03] active:scale-[0.98]"
                >
                  <BarChart3 size={16} />
                  Plonger dans les stats
                </Link>
              </div>
            </div>

            {/* Decorative basketball */}
            <div className="hidden shrink-0 lg:block">
              <div className="relative flex h-48 w-48 items-center justify-center">
                <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-dashed border-accent/15" />
                <div className="absolute inset-4 animate-reverse-spin rounded-full border border-accent/10" />
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-accent animate-bounce-subtle">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" opacity="0.6" />
                    <path d="M4 32 h56" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                    <path d="M32 4 v56" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                    <path d="M10 10 C22 20 42 44 54 54" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
                    <path d="M54 10 C42 20 22 44 10 54" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Article à la une ─────────────────── */}
      {featured && (
        <section>
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
              {/* Image */}
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
                <div className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-accent/10 to-accent/5 lg:aspect-auto lg:w-1/2">
                  <div className="flex flex-col items-center gap-3 text-accent/30">
                    <FileText size={48} />
                    <span className="text-xs font-medium uppercase tracking-widest">Article</span>
                  </div>
                </div>
              )}

              {/* Content */}
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
        </section>
      )}

      {/* ── Categories Grid ──────────────────── */}
      <section>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-text-primary">Explorez la ligue</h2>
          <p className="mt-1 text-sm text-text-muted">
            Sept rubriques, zéro excuse pour rater quoi que ce soit.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => (
            <Link
              key={cat.href}
              href={cat.href}
              className="home-card group relative overflow-hidden rounded-2xl border border-border-t bg-card p-6 transition-all duration-300 hover:border-border-hover hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 active:translate-y-0"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

              <div className="relative">
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${cat.iconBg} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                  {cat.icon}
                </div>

                <h3 className="text-lg font-bold text-text-primary">{cat.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{cat.description}</p>

                <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-accent opacity-0 transition-all duration-300 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0">
                  Consulter
                  <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Le saviez-vous ───────────────────── */}
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

      {/* ── Bottom CTA ───────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent p-8 sm:p-10">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-text-primary">
              On joue ce soir ?
            </h3>
            <p className="mt-1.5 text-sm text-text-secondary">
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

      {/* ── Footer ───────────────────────────── */}
      <p className="pb-4 text-center text-xs text-text-faint">
        Fait par des passionnés, pour des passionnés.
      </p>
    </div>
  );
}
