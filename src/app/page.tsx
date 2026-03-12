import { Newspaper, FileText, BarChart3, TrendingUp, Flame, Star } from "lucide-react";

function StatCard({ label, value, icon, trend }: { label: string; value: string; icon: React.ReactNode; trend?: string }) {
  return (
    <div className="group rounded-2xl bg-[#111827] border border-white/5 p-6 transition-all duration-300 hover:border-orange-500/20 hover:shadow-lg hover:shadow-orange-500/5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-white">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
              <TrendingUp size={12} />
              {trend}
            </div>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 transition-colors group-hover:bg-orange-500/20">
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickLink({ title, description, icon, href }: { title: string; description: string; icon: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      className="group flex items-center gap-4 rounded-2xl bg-[#111827] border border-white/5 p-5 transition-all duration-300 hover:border-orange-500/20 hover:shadow-lg hover:shadow-orange-500/5"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-gray-400 transition-colors group-hover:bg-orange-500/10 group-hover:text-orange-500">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </a>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Bienvenue sur <span className="text-orange-500">NBAHub</span>
        </h1>
        <p className="mt-2 text-lg text-gray-400">
          Suivez toute l&apos;actualité NBA en un seul endroit.
        </p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Matchs ce soir" value="8" icon={<Flame size={22} />} trend="+2 vs hier" />
        <StatCard label="Articles récents" value="24" icon={<FileText size={22} />} trend="Cette semaine" />
        <StatCard label="Joueurs suivis" value="12" icon={<Star size={22} />} />
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Accès rapide</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            href="/actualites"
            title="Actualités"
            description="Les dernières news NBA"
            icon={<Newspaper size={20} />}
          />
          <QuickLink
            href="/articles"
            title="Articles"
            description="Analyses et décryptages"
            icon={<FileText size={20} />}
          />
          <QuickLink
            href="/statistiques"
            title="Statistiques"
            description="Stats joueurs et équipes"
            icon={<BarChart3 size={20} />}
          />
        </div>
      </div>

      {/* Recent activity placeholder */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Activité récente</h2>
        <div className="space-y-3">
          {[
            { title: "Lakers vs Celtics — Résumé du match", time: "Il y a 2h" },
            { title: "Top 10 des actions de la nuit", time: "Il y a 5h" },
            { title: "Trade deadline : les rumeurs à suivre", time: "Il y a 8h" },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-center justify-between rounded-xl bg-[#111827] border border-white/5 px-5 py-4 transition-all duration-200 hover:border-white/10"
            >
              <span className="text-sm font-medium text-gray-300">{item.title}</span>
              <span className="text-xs text-gray-600">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
