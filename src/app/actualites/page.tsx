import { getNews } from "@/lib/actions/news";
import { isAdmin } from "@/lib/actions/auth";
import NewsList from "@/components/NewsList";

export default async function Actualites() {
  const [news, admin] = await Promise.all([getNews(), isAdmin()]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <NewsList news={news} isAdmin={admin} />
    </div>
  );
}
