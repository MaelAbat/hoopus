import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";
import Link from "next/link";
import { Target } from "lucide-react";

export default function MiniJeux() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Mini-jeux"
        subtitle="Teste tes connaissances NBA"
        image="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&q=80"
      />
      <ScrollReveal variant="up" delay={100}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/mini-jeux/hoopl"
            className="group rounded-2xl bg-card border border-border-t p-6 transition-all duration-200 hover:border-accent/50 hover:shadow-lg hover:-translate-y-1"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-text">
                <Target size={22} />
              </div>
              <h2 className="text-lg font-bold text-text-primary group-hover:text-accent-text transition-colors">Hoopl</h2>
            </div>
            <p className="text-sm text-text-muted">
              Devine le joueur NBA du jour a partir de ses statistiques. A chaque essai, decouvre si tes indices sont trop hauts, trop bas ou corrects.
            </p>
          </Link>
        </div>
      </ScrollReveal>
    </div>
  );
}
