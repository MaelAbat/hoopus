import type { Metadata } from "next";

// Default metadata for the mini-jeux hub (a client component, so it can't
// export metadata itself). Individual game pages override the title.
export const metadata: Metadata = {
  title: "Mini-jeux NBA",
  description:
    "Les mini-jeux NBA de Hoopus : devine le joueur du jour, quiz de culture, mots mêlés, plus ou moins, classements et chaînes de coéquipiers. Joue et grimpe au classement.",
  alternates: { canonical: "/mini-jeux" },
  openGraph: {
    title: "Mini-jeux NBA · Hoopus",
    description: "Quiz, devinettes et défis quotidiens autour de la NBA.",
  },
};

export default function MiniJeuxLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
