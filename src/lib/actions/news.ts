"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) throw new Error("Accès refusé");
  return supabase;
}

export async function getNews() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getNewsById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createNews(formData: FormData) {
  const supabase = await requireAdmin();

  const image_url = (formData.get("image_url") as string) || null;
  const { error } = await supabase.from("news").insert({
    title: formData.get("title") as string,
    category: formData.get("category") as string,
    excerpt: formData.get("excerpt") as string,
    featured: formData.get("featured") === "on",
    image_url,
  });

  if (error) throw error;
  revalidatePath("/actualites");
}

export async function updateNews(id: string, formData: FormData) {
  const supabase = await requireAdmin();

  const image_url = (formData.get("image_url") as string) || null;
  const { error } = await supabase
    .from("news")
    .update({
      title: formData.get("title") as string,
      category: formData.get("category") as string,
      excerpt: formData.get("excerpt") as string,
      featured: formData.get("featured") === "on",
      image_url,
    })
    .eq("id", id);

  if (error) throw error;
  revalidatePath("/actualites");
}

export async function deleteNews(id: string) {
  const supabase = await requireAdmin();

  const { error } = await supabase.from("news").delete().eq("id", id);

  if (error) throw error;
  revalidatePath("/actualites");
}
