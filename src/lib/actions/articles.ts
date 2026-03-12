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

export async function getArticles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getArticleById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createArticle(formData: FormData) {
  const supabase = await requireAdmin();

  const { error } = await supabase.from("articles").insert({
    title: formData.get("title") as string,
    tag: formData.get("tag") as string,
    excerpt: formData.get("excerpt") as string,
    content: formData.get("content") as string,
    author: formData.get("author") as string,
    read_time: formData.get("read_time") as string,
  });

  if (error) throw error;
  revalidatePath("/articles");
}

export async function updateArticle(id: string, formData: FormData) {
  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("articles")
    .update({
      title: formData.get("title") as string,
      tag: formData.get("tag") as string,
      excerpt: formData.get("excerpt") as string,
      content: formData.get("content") as string,
      author: formData.get("author") as string,
      read_time: formData.get("read_time") as string,
    })
    .eq("id", id);

  if (error) throw error;
  revalidatePath("/articles");
}

export async function deleteArticle(id: string) {
  const supabase = await requireAdmin();

  const { error } = await supabase.from("articles").delete().eq("id", id);

  if (error) throw error;
  revalidatePath("/articles");
}
