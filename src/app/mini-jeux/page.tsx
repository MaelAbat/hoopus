import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import Link from "next/link";
import { Target, Image, Sparkles, Trophy, Clock, ArrowRight } from "lucide-react";

const games = [
  {
    href: "/mini-jeux/hoopl",
    title: "Hoopl",
    description: "Devine le joueur NBA du jour a partir de ses statistiques. Equipe, conference, division, stats... chaque essai te rapproche de la reponse.",
    icon: <Target size={24} />,
    color: "#f97316",
    tags: ["Stats", "10 essais"],
  },
  {
    href: "/mini-jeux/hoopixl",
    title: "Hoopixl",
    description: "Une photo pixelisee se revele lentement. Reconnais le joueur avant que l'image ne devienne nette. Le temps joue contre toi !",
    icon: <Image size={24} />,
    color: "#8b5cf6",
    tags: ["Visuel", "5 essais"],
  },
];

export default function MiniJeux() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Mini-jeux"
        subtitle="Teste tes connaissances NBA"
        image="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&q=80"
      />

      {/* Daily challenge banner */}
      <ScrollReveal variant="scale">
        <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/10 via-card to-card">
          <div className="absolute top-0 right-0 w-40 h-40 opacity-[0.06]">
            <svg viewBox="0 0 100 100" className="w-full h-full text-accent">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" />
              <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div className="relative px-6 py-6 sm:px-8 sm:py-8 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/15">
              <Sparkles size={26} className="text-accent-text" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-text-primary">Defi quotidien</h2>
              <p className="text-sm text-text-muted mt-0.5">
                Chaque jour a minuit, de nouveaux joueurs mysteres t'attendent. Joue, compare ton score et defie tes amis !
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-faint">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-accent-text" />
                <span>Reset a minuit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy size={14} className="text-accent-text" />
                <span>Classement du jour</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Games grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {games.map((game, i) => (
          <ScrollReveal key={game.href} delay={i * 100} variant="up">
            <Link
              href={game.href}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-t bg-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 hover:border-border-hover active:translate-y-0"
            >
              {/* Colored top accent */}
              <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${game.color}, ${game.color}88)` }} />

              <div className="p-6 flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: game.color }}
                    >
                      {game.icon}
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-text-primary group-hover:text-accent-text transition-colors tracking-tight">{game.title}</h2>
                      <div className="flex gap-1.5 mt-0.5">
                        {game.tags.map((tag) => (
                          <span key={tag} className="inline-block rounded-full bg-input px-2 py-0.5 text-[10px] font-semibold text-text-faint">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm leading-relaxed text-text-muted flex-1">
                  {game.description}
                </p>

                {/* CTA */}
                <div
                  className="mt-4 flex items-center gap-1.5 text-sm font-bold opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0"
                  style={{ color: game.color }}
                >
                  Jouer maintenant
                  <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          </ScrollReveal>
        ))}
      </div>

      {/* Coming soon teaser */}
      <ScrollReveal variant="blur">
        <div className="rounded-2xl border border-dashed border-border-t bg-card/50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-text-faint">D'autres mini-jeux arrivent bientot...</p>
        </div>
      </ScrollReveal>
    </div>
  );
}
