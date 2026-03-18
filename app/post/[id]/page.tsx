import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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
  location: string;
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
    supabase
      .from("votes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", Number(id)),
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

  const title = `${post.title} | 避坑 Be Calm`;
  const description = buildDescription(post);
  const url = `https://becalm.social/post/${post.id}`;
  const image =
    post.image_url ||
    (post.media_urls?.find((item) => item.type === "image")?.url ?? "/becalm-main-logo.png");

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
          url: image,
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
      images: [image],
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

  const mainImage =
    post.image_url ||
    (post.media_urls?.find((item) => item.type === "image")?.url ?? null);

  const mainVideo =
    post.video_url ||
    (post.media_urls?.find((item) => item.type === "video")?.url ?? null);

  const authorName =
    post.author_profile?.display_name ||
    post.author_profile?.username ||
    "匿名使用者";

  const postUrl = `https://becalm.social/post/${post.id}`;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            ← 回首頁
          </Link>
        </div>

        <article className="overflow-hidden rounded-[32px] bg-white shadow-sm ring-1 ring-slate-200/70">
          {mainImage && (
            <img
              src={mainImage}
              alt={post.title}
              className="h-auto w-full object-cover"
            />
          )}

          {mainVideo && !mainImage && (
            <video
              src={mainVideo}
              controls
              className="w-full"
              preload="metadata"
            />
          )}

          <div className="p-6 sm:p-8">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {post.category}
              </span>

              {post.country && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {post.country}
                </span>
              )}

              {post.city && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {post.city}
                </span>
              )}

              {post.incident_type && (
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  {post.incident_type}
                </span>
              )}

              {post.risk_level && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  風險 {post.risk_level}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-black leading-tight text-slate-900">
              {post.title}
            </h1>

            <div className="mt-3 text-sm text-slate-500">
              作者：{authorName}
              {post.created_at
                ? ` ・ ${new Date(post.created_at).toLocaleString("zh-TW")}`
                : ""}
            </div>

            {(post.location || post.place_name) && (
              <div className="mt-2 text-sm text-slate-600">
                地點：{post.place_name || post.location}
              </div>
            )}

            <div className="mt-6 whitespace-pre-wrap text-[15px] leading-8 text-slate-800">
              {post.content}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700">
                坑 {post.pitCount}
              </span>
              <span className="rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700">
                留言 {post.commentCount}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {post.external_url && (
                <a
                  href={post.external_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  相關連結
                </a>
              )}

              {post.google_maps_url && (
                <a
                  href={post.google_maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
                >
                  Google Maps
                </a>
              )}

              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                分享文章
              </a>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}