import { isAdmin } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import QuizEditor from "@/components/QuizEditor";

export default async function CreateQuizPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/mini-jeux/hoopiz");

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-0 pb-8">
      <QuizEditor />
    </div>
  );
}
