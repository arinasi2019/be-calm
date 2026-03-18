import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

type PostRow = {
  id: number;
  created_at: string | null;
};

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase env 缺失，請確認 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://becalm.social";
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("posts")
    .select("id, created_at")
    .order("id", { ascending: false });

  const posts = ((data || []) as PostRow[]).map((post) => ({
    url: `${baseUrl}/post/${post.id}`,
    lastModified: post.created_at ? new Date(post.created_at) : new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...posts,
  ];
}