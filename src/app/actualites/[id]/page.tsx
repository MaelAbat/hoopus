import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clock } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";

export const revalidate = 3600;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Il y a quelques minutes";
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return formatDate(dateStr);
}

export default async function NewsDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: newsItem }, { data: otherNews }] = await Promise.all([
    supabase.from("news").select("*").eq("id", id).single(),
    supabase.from("news").select("id, title, category, image_url, created_at").neq("id", id).order("created_at", { ascending: false }).limit(4),
  ]);

  if (!newsItem) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href="/actualites"
        className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-input hover:text-text-primary"
      >
        <ChevronLeft size={16} />
        Toutes les actus
      </Link>

      {/* Hero image */}
      <ScrollReveal variant="scale">
        <div className="relative overflow-hidden rounded-2xl border border-border-t">
          {newsItem.image_url ? (
            <div className="aspect-[21/9] w-full overflow-hidden bg-input">
              <img
                src={newsItem.image_url}
                alt={newsItem.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
          ) : (
            <div className="aspect-[21/9] w-full overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1527261834078-9b37d35a4a32?w=1200&q=80"
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
              {newsItem.category}
            </span>
            <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight text-white">
              {newsItem.title}
            </h1>
          </div>
        </div>
      </ScrollReveal>

      {/* Date */}
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Clock size={14} className="text-accent" />
        <span>{formatRelative(newsItem.created_at)}</span>
        <span className="text-text-faint">--</span>
        <span className="text-text-faint">{formatDate(newsItem.created_at)}</span>
      </div>

      {/* Content */}
      <ScrollReveal variant="up" delay={100}>
        <div className="rounded-2xl bg-card border border-border-t p-5 sm:p-8 lg:p-10">
          <p className="text-base sm:text-lg leading-relaxed text-text-secondary">
            {newsItem.excerpt}
          </p>
        </div>
      </ScrollReveal>

      {/* Other news */}
      {otherNews && otherNews.length > 0 && (
        <ScrollReveal variant="up" delay={200}>
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-text-primary">Autres actualites</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {otherNews.map((item) => (
                <Link
                  key={item.id}
                  href={`/actualites/${item.id}`}
                  className="group flex gap-3 rounded-xl bg-card border border-border-t p-3 transition-all duration-200 hover:border-border-hover hover:shadow-lg"
                >
                  {item.image_url && (
                    <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-input">
                      <img
                        src={item.image_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold text-accent uppercase">{item.category}</span>
                    <p className="mt-0.5 text-sm font-semibold text-text-primary leading-snug line-clamp-2 group-hover:text-accent-text transition-colors">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[10px] text-text-faint">{formatRelative(item.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Back link */}
      <div className="pb-8 text-center">
        <Link
          href="/actualites"
          className="inline-flex items-center gap-2 rounded-xl bg-input px-5 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-card-hover hover:text-text-primary"
        >
          <ChevronLeft size={14} />
          Retour aux actualites
        </Link>
      </div>
    </div>
  );
}
