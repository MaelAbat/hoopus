"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

  const { error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    return { error: error.message };
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

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: formData.get("display_name") as string,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/profil");
}
