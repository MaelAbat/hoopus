import { Clock, BookOpen } from "lucide-react";

const articles = [
  {
    id: 1,
    tag: "Analyse",
    title: "Pourquoi le jeu sans ballon est devenu la clé du basket moderne",
    excerpt: "Le mouvement off-ball n'a jamais été aussi important. Décryptage d'une tendance qui redéfinit le jeu.",
    author: "Thomas M.",
    readTime: "8 min",
    date: "12 mars 2026",
  },
  {
    id: 2,
    tag: "Histoire",
    title: "Retour sur la dynastie des Warriors : 2015-2023",
    excerpt: "De la montée en puissance au déclin, comment Golden State a changé le visage de la NBA à jamais.",
    author: "Julie R.",
    readTime: "12 min",
    date: "10 mars 2026",
  },
  {
    id: 3,
    tag: "Tactique",
    title: "Le small ball est-il mort ? Les centres dominent à nouveau",
    excerpt: "Après des années de small ball, les pivots reprennent le pouvoir. Analyse des chiffres qui le prouvent.",
    author: "Marc D.",
    readTime: "6 min",
    date: "8 mars 2026",
  },
  {
    id: 4,
    tag: "Portrait",
    title: "Victor Wembanyama : la saison de la confirmation",
    excerpt: "En sa deuxième année, le Français confirme tout son potentiel et se positionne comme futur MVP.",
    author: "Sarah L.",
    readTime: "10 min",
    date: "5 mars 2026",
  },
];

export default function Articles() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Articles</h1>
        <p className="mt-1 text-gray-500">Analyses, décryptages et portraits</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {articles.map((article) => (
          <article
            key={article.id}
            className="group cursor-pointer rounded-2xl bg-[#111827] border border-white/5 p-6 transition-all duration-300 hover:border-orange-500/20 hover:shadow-lg hover:shadow-orange-500/5"
          >
            <span className="inline-block rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-400">
              {article.tag}
            </span>
            <h2 className="mt-4 text-xl font-bold text-white leading-snug transition-colors group-hover:text-orange-400">
              {article.title}
            </h2>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">
              {article.excerpt}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
              <span className="text-sm font-medium text-gray-300">{article.author}</span>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <BookOpen size={12} />
                  {article.readTime}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {article.date}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
