import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clock, BookOpen, User } from "lucide-react";
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

export default async function ArticleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();

  if (!article) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href="/articles"
        className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-input hover:text-text-primary"
      >
        <ChevronLeft size={16} />
        Tous les articles
      </Link>

      {/* Hero image */}
      <ScrollReveal variant="scale">
        <div className="relative overflow-hidden rounded-2xl border border-border-t">
          {article.image_url ? (
            <div className="aspect-[21/9] w-full overflow-hidden bg-input">
              <img
                src={article.image_url}
                alt={article.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
          ) : (
            <div className="aspect-[21/9] w-full overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1529243856184-fd5465488984?w=1200&q=80"
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            </div>
          )}

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
              {article.tag}
            </span>
            <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight text-white">
              {article.title}
            </h1>
          </div>
        </div>
      </ScrollReveal>

      {/* Metadata bar */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-text-muted">
        <span className="flex items-center gap-2">
          <User size={14} className="text-accent" />
          <span className="font-medium text-text-secondary">{article.author}</span>
        </span>
        <span className="flex items-center gap-2">
          <Clock size={14} />
          {formatDate(article.created_at)}
        </span>
        <span className="flex items-center gap-2">
          <BookOpen size={14} />
          {article.read_time}
        </span>
      </div>

      {/* Excerpt */}
      {article.excerpt && (
        <p className="text-lg leading-relaxed text-text-secondary border-l-4 border-accent/30 pl-4 sm:pl-6 italic">
          {article.excerpt}
        </p>
      )}

      {/* Article body */}
      <ScrollReveal variant="up" delay={100}>
        <div className="rounded-2xl bg-card border border-border-t p-5 sm:p-8 lg:p-10">
          <div className="prose-custom text-base leading-relaxed text-text-secondary whitespace-pre-wrap">
            {article.content}
          </div>
        </div>
      </ScrollReveal>

      {/* Back link */}
      <div className="pb-8 text-center">
        <Link
          href="/articles"
          className="inline-flex items-center gap-2 rounded-xl bg-input px-5 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-card-hover hover:text-text-primary"
        >
          <ChevronLeft size={14} />
          Retour aux articles
        </Link>
      </div>
    </div>
  );
}
