import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";

export default function MiniJeux() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Mini-jeux"
        subtitle="Teste tes connaissances NBA"
        image="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&q=80"
      />
      <ScrollReveal variant="up" delay={100}>
        <div className="rounded-2xl bg-card border border-border-t px-6 py-16 text-center">
          <p className="text-text-muted">Bientot disponible</p>
        </div>
      </ScrollReveal>
    </div>
  );
}
