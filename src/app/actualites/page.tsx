import { Clock, ArrowRight } from "lucide-react";

const news = [
  {
    id: 1,
    category: "Trade",
    title: "Un blockbuster trade entre les Lakers et les Nets secoue la ligue",
    excerpt: "Les deux franchises auraient trouvé un accord impliquant plusieurs joueurs majeurs et des picks de draft.",
    time: "Il y a 30 min",
    featured: true,
  },
  {
    id: 2,
    category: "Match",
    title: "Les Celtics enchaînent une 10ème victoire consécutive",
    excerpt: "Boston domine Milwaukee 118-102 derrière un Jayson Tatum à 38 points.",
    time: "Il y a 2h",
    featured: false,
  },
  {
    id: 3,
    category: "Blessure",
    title: "Mise à jour sur la blessure de Luka Doncic",
    excerpt: "Le Slovène est annoncé out pour 2 à 3 semaines avec une entorse à la cheville.",
    time: "Il y a 4h",
    featured: false,
  },
  {
    id: 4,
    category: "Draft",
    title: "Mock Draft 2026 : les projections mises à jour",
    excerpt: "Après le tournoi NCAA, les positions ont bougé dans le top 10.",
    time: "Il y a 6h",
    featured: false,
  },
  {
    id: 5,
    category: "Classement",
    title: "La course aux playoffs dans l'Ouest : 6 équipes pour 3 places",
    excerpt: "À un mois de la fin de la saison régulière, la bataille fait rage.",
    time: "Il y a 8h",
    featured: false,
  },
];

export default function Actualites() {
  const featured = news.find((n) => n.featured);
  const others = news.filter((n) => !n.featured);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Actualités</h1>
        <p className="mt-1 text-gray-500">Les dernières nouvelles de la NBA</p>
      </div>

      {/* Featured */}
      {featured && (
        <div className="group cursor-pointer rounded-2xl bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 p-8 transition-all duration-300 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5">
          <span className="inline-block rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold text-orange-400">
            {featured.category}
          </span>
          <h2 className="mt-4 text-2xl font-bold text-white">{featured.title}</h2>
          <p className="mt-2 text-gray-400 leading-relaxed">{featured.excerpt}</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock size={14} />
              {featured.time}
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-orange-500 transition-transform group-hover:translate-x-1">
              Lire la suite <ArrowRight size={14} />
            </span>
          </div>
        </div>
      )}

      {/* News list */}
      <div className="space-y-3">
        {others.map((item) => (
          <div
            key={item.id}
            className="group cursor-pointer rounded-2xl bg-[#111827] border border-white/5 p-6 transition-all duration-200 hover:border-orange-500/20 hover:shadow-lg hover:shadow-orange-500/5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <span className="inline-block rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-gray-400">
                  {item.category}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{item.excerpt}</p>
              </div>
              <ArrowRight size={16} className="mt-8 shrink-0 text-gray-600 transition-all group-hover:translate-x-1 group-hover:text-orange-500" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
              <Clock size={12} />
              {item.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
