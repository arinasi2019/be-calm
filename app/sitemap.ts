import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

type PostRow = {
  id: number;
  created_at?: string | null;
  updated_at?: string | null;
};

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase env 缺失，請確認 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://becalm.social";
  const supabase = getSupabaseServerClient();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/write`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/profile`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  const { data, error } = await supabase
    .from("posts")
    .select("id, created_at, updated_at")
    .order("id", { ascending: false });

  if (error) {
    console.error("sitemap posts load error:", error);
    return staticPages;
  }

  const posts: MetadataRoute.Sitemap = ((data || []) as PostRow[]).map((post) => ({
    url: `${baseUrl}/post/${post.id}`,
    lastModified: new Date(post.updated_at || post.created_at || Date.now()),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...posts];
}