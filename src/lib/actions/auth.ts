"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const SCORE_TABLES = [
  "hoopl_scores",
  "hoopixl_scores",
  "hoopgrid_scores",
  "hoopmore_scores",
  "hooprank_scores",
  "hooplink_scores",
  "quiz_scores",
] as const;

/** Update display_name in all score tables for a given user. */
async function syncDisplayNameInScores(userId: string, displayName: string) {
  const supabase = await createClient();
  await Promise.all(
    SCORE_TABLES.map((table) =>
      supabase.from(table).update({ display_name: displayName }).eq("user_id", userId)
    )
  );
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: error.message };
  }

  const redirectTo = formData.get("redirectTo") as string | null;
  revalidatePath("/", "layout");
  redirect(redirectTo || "/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const displayName = formData.get("display_name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Check if current session is anonymous — upgrade instead of creating a new user
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  if (currentUser?.is_anonymous) {
    // Convert anonymous user to permanent by adding email + password
    const { error } = await supabase.auth.updateUser({
      email,
      password,
      data: { display_name: displayName },
    });

    if (error) {
      return { error: error.message };
    }

    // Update profile and all score tables with real display name
    await supabase.from("profiles").update({
      email,
      display_name: displayName,
    }).eq("id", currentUser.id);

    await syncDisplayNameInScores(currentUser.id, displayName);
  } else {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (error) {
      return { error: error.message };
    }
  }

  const redirectTo = formData.get("redirectTo") as string | null;
  revalidatePath("/", "layout");
  redirect(redirectTo || "/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}

export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function isAdmin() {
  const profile = await getProfile();
  return profile?.is_admin === true;
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Non connecté" };

  const newName = formData.get("display_name") as string;

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: newName })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await syncDisplayNameInScores(user.id, newName);
  revalidatePath("/profil");
}
