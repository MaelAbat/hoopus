import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { ChevronLeft, Clock, BookOpen, User } from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import MarkdownContent from "@/components/MarkdownContent";
import JsonLd from "@/components/JsonLd";
import { OG_IMAGE } from "@/lib/seo";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoopus.fr";

// Wrapped in cache() so generateMetadata and the page share a single DB read.
const getArticle = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("articles").select("*").eq("id", id).single();
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) return { title: "Article introuvable", robots: { index: false, follow: false } };

  const description = article.excerpt || `${article.title} — un article à lire sur Hoopus.`;
  return {
    title: article.title,
    description,
    alternates: { canonical: `/articles/${id}` },
    openGraph: {
      title: article.title,
      description,
      type: "article",
      url: `${siteUrl}/articles/${id}`,
      publishedTime: article.created_at,
      authors: article.author ? [article.author] : undefined,
      tags: article.tag ? [article.tag] : undefined,
      images: article.image_url ? [{ url: article.image_url }] : [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: article.image_url ? [article.image_url] : [OG_IMAGE],
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

export default async function ArticleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);

  if (!article) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt || undefined,
    image: article.image_url || undefined,
    datePublished: article.created_at,
    author: article.author ? { "@type": "Person", name: article.author } : undefined,
    publisher: {
      "@type": "Organization",
      name: "Hoopus",
      logo: { "@type": "ImageObject", url: `${siteUrl}/icon.svg` },
    },
    mainEntityOfPage: `${siteUrl}/articles/${id}`,
    articleSection: article.tag || undefined,
    inLanguage: "fr-FR",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <JsonLd data={jsonLd} />
      <Link
        href="/articles"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
      >
        <ChevronLeft size={16} />
        Tous les articles
      </Link>

      {/* Hero image */}
      <ScrollReveal variant="scale">
        <div className="relative overflow-hidden border border-rule bg-input">
          {article.image_url ? (
            <div className="aspect-[21/9] w-full overflow-hidden">
              <img
                src={article.image_url}
                alt={article.title}
                className="h-full w-full object-cover grayscale"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            </div>
          ) : (
            <div className="aspect-[21/9] w-full overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1529243856184-fd5465488984?w=1200&q=80"
                alt=""
                className="h-full w-full object-cover grayscale"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </div>
          )}

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <span className="inline-block bg-accent px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
              {article.tag}
            </span>
            <h1 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl leading-[1.02] text-white">
              {article.title}
            </h1>
          </div>
        </div>
      </ScrollReveal>

      {/* Metadata bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-rule py-3 font-mono text-[11px] uppercase tracking-wider text-text-muted">
        <span className="flex items-center gap-2">
          <User size={14} className="text-accent" />
          <span className="font-semibold text-text-secondary">{article.author}</span>
        </span>
        <span className="flex items-center gap-2">
          <Clock size={14} />
          <span className="tnum">{formatDate(article.created_at)}</span>
        </span>
        <span className="flex items-center gap-2">
          <BookOpen size={14} />
          <span className="tnum">{article.read_time}</span>
        </span>
      </div>

      {/* Excerpt */}
      {article.excerpt && (
        <p className="text-lg leading-relaxed text-text-secondary border-l-4 border-accent pl-4 sm:pl-6 italic">
          {article.excerpt}
        </p>
      )}

      {/* Article body */}
      <ScrollReveal variant="up" delay={100}>
        <div className="border border-rule bg-card p-5 sm:p-8 lg:p-10">
          <MarkdownContent content={article.content} />
        </div>
      </ScrollReveal>

      {/* Back link */}
      <div className="pb-8 text-center">
        <Link
          href="/articles"
          className="inline-flex items-center gap-2 border border-border-hover px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-text-primary transition-colors hover:bg-input"
        >
          <ChevronLeft size={14} />
          Retour aux articles
        </Link>
      </div>
    </div>
  );
}
