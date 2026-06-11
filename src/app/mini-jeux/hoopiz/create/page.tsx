import { isAdmin } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import QuizEditor from "@/components/QuizEditor";

export const metadata = {
  title: "Créer un quiz",
  robots: { index: false, follow: false },
};

export default async function CreateQuizPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/mini-jeux/hoopiz");

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-0 pb-8">
      <QuizEditor />
    </div>
  );
}
