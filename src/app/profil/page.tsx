import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Star, Shield } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import ProfileForm from "@/components/ProfileForm";
import ThemePicker from "@/components/ThemePicker";
import ProfileFavorites from "@/components/ProfileFavorites";
import AchievementsGrid from "@/components/AchievementsGrid";

export const metadata = {
  title: "Mon profil",
  robots: { index: false, follow: false },
};

export default async function Profil() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    redirect("/auth/login");
  }

  const [{ data: profile }, { data: activePlayers }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("players")
      .select("player_id, first_name, last_name, team_tricode, position")
      .eq("is_active", true)
      .order("last_name"),
  ]);

  const memberSince = new Date(user.created_at).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Profil</h1>
        <p className="mt-1 text-text-muted">Gérez vos préférences et vos favoris</p>
      </div>

      {/* User card */}
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-card border border-border-t p-6 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-hover text-3xl font-bold text-white shadow-lg">
          {profile?.display_name?.charAt(0).toUpperCase() || "U"}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-2xl font-bold text-text-primary">{profile?.display_name}</h2>
          <p className="text-sm text-text-muted">{user.email}</p>
          <p className="text-xs text-text-faint mt-1">Membre depuis {memberSince}</p>
          <div className="mt-2 flex justify-center gap-2 sm:justify-start">
            {profile?.is_admin ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-text">
                <Shield size={12} /> Administrateur
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-text">
                <Star size={12} /> Fan NBA
              </span>
            )}
          </div>
        </div>
        <LogoutButton />
      </div>

      {/* Edit display name */}
      <ProfileForm currentName={profile?.display_name || ""} />

      {/* Apparence */}
      <ThemePicker />

      {/* Succès */}
      <AchievementsGrid />

      {/* Favorites */}
      <ProfileFavorites allPlayers={activePlayers || []} />
    </div>
  );
}
