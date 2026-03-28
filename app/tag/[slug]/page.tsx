"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PostFeed from "../../components/PostFeed";
import { supabase } from "../../lib/supabase";

type MediaItem = {
  type: "image" | "video";
  url: string;
};

type RiskLevel = "低" | "中" | "高";

type Profile = {
  id: string;
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type Post = {
  id: number;
  user_id?: string | null;
  title: string;
  category: string;
  country?: string | null;
  city?: string | null;
  location?: string | null;
  content: string;
  created_at: string | null;
  image_url?: string | null;
  video_url?: string | null;
  place_name?: string | null;
  google_maps_url?: string | null;
  external_url?: string | null;
  media_urls?: MediaItem[] | null;
  incident_type?: string | null;
  risk_level?: RiskLevel | null;
  content_type?: "normal" | "incident" | null;
  author_profile?: Profile | null;
  hashtags?: string[] | null;
  is_seed?: boolean;
  seed_author_name?: string | null;
  seed_author_slug?: string | null;
  source_type?: string | null;
  is_featured?: boolean | null;
  published_at?: string | null;
  can_try?: boolean | null;
  booking_url?: string | null;
  price_from?: number | null;
  try_button_label?: string | null;
  pitfall_summary?: string[] | null;
};

export default function TagPage({
  params,
}: {
  params: { slug: string };
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const decodedTag = decodeURIComponent(params.slug).toLowerCase();

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: postsData, error } = await supabase
        .from("posts")
        .select("*")
        .contains("hashtags", [decodedTag])
        .order("id", { ascending: false });

      if (error) {
        console.error("載入 tag 貼文失敗：", error.message);
        setPosts([]);
        setLoading(false);
        return;
      }

      const rawPosts = (postsData as Post[]) || [];
      const userIds = Array.from(
        new Set(rawPosts.map((post) => post.user_id).filter(Boolean) as string[])
      );

      const profileMap: Record<string, Profile> = {};

      if (userIds.length > 0) {
        const profilesRes = await supabase
          .from("profiles")
          .select("id, email, username, display_name, avatar_url")
          .in("id", userIds);

        if (!profilesRes.error) {
          ((profilesRes.data as Profile[]) || []).forEach((profile) => {
            profileMap[profile.id] = profile;
          });
        }
      }

      const nextPosts = rawPosts.map((post) => ({
        ...post,
        author_profile: post.user_id ? profileMap[post.user_id] || null : null,
      }));

      setPosts(nextPosts);
      setLoading(false);
    }

    load();
  }, [decodedTag]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <Link
            href="/"
            className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700"
          >
            ← 回首頁
          </Link>

          <h1 className="mt-4 text-3xl font-black">#{decodedTag}</h1>
          <p className="mt-2 text-sm text-slate-500">
            與這個 hashtag 相關的避坑內容
          </p>
        </div>

        {loading ? (
          <div className="rounded-[28px] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70">
            載入中...
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-[28px] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70 text-slate-500">
            目前還沒有這個 hashtag 的貼文
          </div>
        ) : (
          <PostFeed posts={posts} />
        )}
      </div>
    </main>
  );
}