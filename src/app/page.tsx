import { Newspaper, FileText, BarChart3, TrendingUp, Flame, Star } from "lucide-react";

function StatCard({ label, value, icon, trend }: { label: string; value: string; icon: React.ReactNode; trend?: string }) {
  return (
    <div className="group rounded-2xl bg-card border border-border-t p-6 transition-all duration-300 hover:border-border-hover hover:shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-1 text-3xl font-bold text-text-primary">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
              <TrendingUp size={12} />
              {trend}
            </div>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-light text-accent transition-colors">
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
      className="group flex items-center gap-4 rounded-2xl bg-card border border-border-t p-5 transition-all duration-300 hover:border-border-hover hover:shadow-lg"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-input text-text-muted transition-colors group-hover:bg-accent-light group-hover:text-accent">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-text-primary">{title}</h3>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
    </a>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-text-primary">
          Bienvenue sur <span className="text-accent">Hoopus</span>
        </h1>
        <p className="mt-2 text-lg text-text-secondary">
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
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Accès rapide</h2>
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

      {/* Recent activity */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Activité récente</h2>
        <div className="space-y-3">
          {[
            { title: "Lakers vs Celtics — Résumé du match", time: "Il y a 2h" },
            { title: "Top 10 des actions de la nuit", time: "Il y a 5h" },
            { title: "Trade deadline : les rumeurs à suivre", time: "Il y a 8h" },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-center justify-between rounded-xl bg-card border border-border-t px-5 py-4 transition-all duration-200 hover:border-border-hover"
            >
              <span className="text-sm font-medium text-text-secondary">{item.title}</span>
              <span className="text-xs text-text-faint">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
