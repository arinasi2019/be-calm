import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import PostDetailClient from "../../components/PostDetailClient";

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
  media_urls?: MediaItem[] | null;
  place_name?: string | null;
  google_maps_url?: string | null;
  external_url?: string | null;
  incident_type?: string | null;
  risk_level?: RiskLevel | null;
  content_type?: "normal" | "incident" | null;
  published_at?: string | null;
  can_try?: boolean | null;
  booking_url?: string | null;
  price_from?: number | null;
  try_button_label?: string | null;
  pitfall_summary?: string[] | null;
  author_profile?: Profile | null;
  pitCount?: number;
  commentCount?: number;
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

function getMediaList(post: Post): MediaItem[] {
  if (post.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
    return [...post.media_urls];
  }

  const fallback: MediaItem[] = [];
  if (post.video_url) fallback.push({ type: "video", url: post.video_url });
  if (post.image_url) fallback.push({ type: "image", url: post.image_url });

  return fallback;
}

async function getPost(id: string) {
  const supabase = getSupabaseServerClient();

  const { data: post, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", Number(id))
    .single();

  if (error || !post) return null;

  let authorProfile: Profile | null = null;

  if (post.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, username, display_name")
      .eq("id", post.user_id)
      .single();

    authorProfile = profile || null;
  }

  const [{ count: voteCount }, { count: commentCount }] = await Promise.all([
    supabase.from("votes").select("*", { count: "exact", head: true }).eq("post_id", Number(id)),
    supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", Number(id)),
  ]);

  return {
    ...(post as Post),
    author_profile: authorProfile,
    pitCount: voteCount || 0,
    commentCount: commentCount || 0,
  };
}

function buildDescription(post: Post) {
  const parts = [
    post.category,
    post.country,
    post.city,
    post.incident_type,
    post.risk_level ? `風險${post.risk_level}` : null,
  ].filter(Boolean);

  const contentPreview = (post.content || "").replace(/\s+/g, " ").slice(0, 90);

  return `${parts.join("・")}｜${contentPreview}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    return {
      title: "文章不存在 | 避坑 Be Calm",
      description: "這篇避坑文章不存在或已被刪除。",
    };
  }

  const mediaList = getMediaList(post);
  const ogImage = mediaList.find((item) => item.type === "image")?.url || "/becalm-main-logo.png";

  const title = `${post.title} | 避坑 Be Calm`;
  const description = buildDescription(post);
  const url = `https://becalm.social/post/${post.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "避坑 Be Calm",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      locale: "zh_TW",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) notFound();

  return <PostDetailClient post={post} />;
}