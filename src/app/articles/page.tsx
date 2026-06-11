import { getArticles } from "@/lib/actions/articles";
import { OG_IMAGE } from "@/lib/seo";
import { isAdmin } from "@/lib/actions/auth";
import ArticlesList from "@/components/ArticlesList";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata = {
  title: "Articles NBA",
  description:
    "Analyses, dossiers et grands formats sur la NBA, écrits en français : décryptages tactiques, portraits de joueurs et rétrospectives à lire sur Hoopus.",
  alternates: { canonical: "/articles" },
  openGraph: {
    title: "Articles NBA · Hoopus",
    description: "Analyses, dossiers et grands formats sur la NBA, en français.",
    images: [OG_IMAGE],
  },
};

export default async function Articles() {
  const [articles, admin] = await Promise.all([getArticles(), isAdmin()]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Articles"
        subtitle="Analyses, decryptages et portraits"
        variant="articles"
      />
      <ScrollReveal variant="up" delay={100}>
        <ArticlesList articles={articles} isAdmin={admin} />
      </ScrollReveal>
    </div>
  );
}
