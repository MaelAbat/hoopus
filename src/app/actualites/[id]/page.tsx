import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { ChevronLeft, Clock } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { OG_IMAGE } from "@/lib/seo";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoopus.fr";

// cache() lets generateMetadata and the page reuse one DB read for the news item.
const getNewsItem = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("news").select("*").eq("id", id).single();
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const newsItem = await getNewsItem(id);
  if (!newsItem) return { title: "Actualité introuvable", robots: { index: false, follow: false } };

  const description = newsItem.excerpt || `${newsItem.title} — l'actualité NBA sur Hoopus.`;
  return {
    title: newsItem.title,
    description,
    alternates: { canonical: `/actualites/${id}` },
    openGraph: {
      title: newsItem.title,
      description,
      type: "article",
      url: `${siteUrl}/actualites/${id}`,
      publishedTime: newsItem.created_at,
      section: newsItem.category || undefined,
      images: newsItem.image_url ? [{ url: newsItem.image_url }] : [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: newsItem.title,
      description,
      images: newsItem.image_url ? [newsItem.image_url] : [OG_IMAGE],
    },
  };
}

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

  const [newsItem, { data: otherNews }] = await Promise.all([
    getNewsItem(id),
    supabase.from("news").select("id, title, category, image_url, created_at").neq("id", id).order("created_at", { ascending: false }).limit(4),
  ]);

  if (!newsItem) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: newsItem.title,
    description: newsItem.excerpt || undefined,
    image: newsItem.image_url || undefined,
    datePublished: newsItem.created_at,
    articleSection: newsItem.category || undefined,
    publisher: {
      "@type": "Organization",
      name: "Hoopus",
      logo: { "@type": "ImageObject", url: `${siteUrl}/icon.svg` },
    },
    mainEntityOfPage: `${siteUrl}/actualites/${id}`,
    inLanguage: "fr-FR",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <JsonLd data={jsonLd} />
      <Link
        href="/actualites"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
      >
        <ChevronLeft size={16} />
        Toutes les actus
      </Link>

      {/* Hero image */}
      <ScrollReveal variant="scale">
        <div className="relative overflow-hidden border border-rule bg-input">
          {newsItem.image_url ? (
            <div className="aspect-[21/9] w-full overflow-hidden">
              <img
                src={newsItem.image_url}
                alt={newsItem.title}
                className="h-full w-full object-cover grayscale"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            </div>
          ) : (
            <div className="aspect-[21/9] w-full overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1527261834078-9b37d35a4a32?w=1200&q=80"
                alt=""
                className="h-full w-full object-cover grayscale"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <span className="inline-block bg-accent px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
              {newsItem.category}
            </span>
            <h1 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl leading-[1.02] text-white">
              {newsItem.title}
            </h1>
          </div>
        </div>
      </ScrollReveal>

      {/* Date */}
      <div className="flex items-center gap-2 border-y border-rule py-3 font-mono text-[11px] uppercase tracking-wider text-text-muted">
        <Clock size={14} className="text-accent" />
        <span className="tnum">{formatRelative(newsItem.created_at)}</span>
        <span className="text-text-faint">--</span>
        <span className="tnum text-text-faint">{formatDate(newsItem.created_at)}</span>
      </div>

      {/* Content */}
      <ScrollReveal variant="up" delay={100}>
        <div className="border border-rule bg-card p-5 sm:p-8 lg:p-10">
          <p className="text-base sm:text-lg leading-relaxed text-text-secondary">
            {newsItem.excerpt}
          </p>
        </div>
      </ScrollReveal>

      {/* Other news */}
      {otherNews && otherNews.length > 0 && (
        <ScrollReveal variant="up" delay={200}>
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-2xl text-text-primary sm:text-3xl">Autres actualités</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {otherNews.map((item) => (
                <Link
                  key={item.id}
                  href={`/actualites/${item.id}`}
                  className="group flex gap-3 border border-rule bg-card p-3 transition-colors hover:border-border-hover"
                >
                  {item.image_url && (
                    <div className="h-16 w-20 shrink-0 overflow-hidden bg-input">
                      <img
                        src={item.image_url}
                        alt=""
                        className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent-text">{item.category}</span>
                    <p className="mt-1 font-display text-sm leading-snug text-text-primary line-clamp-2 group-hover:text-accent-text transition-colors sm:text-base">
                      {item.title}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider tnum text-text-faint">{formatRelative(item.created_at)}</p>
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
          className="inline-flex items-center gap-2 border border-border-hover px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-text-primary transition-colors hover:bg-input"
        >
          <ChevronLeft size={14} />
          Retour aux actualités
        </Link>
      </div>
    </div>
  );
}
