"use client";

import { useEffect, useMemo, useState } from "react";
import PostActions from "./PostActions";
import BottomNav from "./BottomNav";

type MediaItem = {
  type: "image" | "video";
  url: string;
};

type Post = {
  id: number;
  title: string;
  category: string;
  location: string;
  content: string;
  created_at: string | null;
  image_url?: string | null;
  video_url?: string | null;
  place_name?: string | null;
  google_maps_url?: string | null;
  external_url?: string | null;
  media_urls?: MediaItem[] | null;
};

type TabType = "home" | "search" | "saved";

function formatDate(dateString: string | null) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("zh-TW");
}

function getExternalLabel(post: Post) {
  if (post.category === "商品") return "🛒 商品連結";
  if (post.category === "旅遊") return "🗺 相關資訊";
  if (post.category === "服務") return "🔗 官方網站";
  return "🔗 相關連結";
}

function getMediaList(post: Post): MediaItem[] {
  if (post.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
    return post.media_urls;
  }

  const fallback: MediaItem[] = [];

  if (post.image_url) {
    fallback.push({ type: "image", url: post.image_url });
  }

  if (post.video_url) {
    fallback.push({ type: "video", url: post.video_url });
  }

  return fallback;
}

function MediaGrid({ post }: { post: Post }) {
  const mediaList = getMediaList(post);

  if (mediaList.length === 0) return null;

  if (mediaList.length === 1) {
    const media = mediaList[0];

    return (
      <div className="px-5 pt-2">
        <div className="overflow-hidden rounded-[22px]">
          {media.type === "image" ? (
            <img
              src={media.url}
              alt={post.title}
              className="h-56 w-full object-cover"
            />
          ) : (
            <video
              src={media.url}
              controls
              playsInline
              preload="metadata"
              className="h-56 w-full bg-black object-cover"
            />
          )}
        </div>
      </div>
    );
  }

  const previewList = mediaList.slice(0, 4);
  const hasMore = mediaList.length > 4;

  return (
    <div className="px-5 pt-2">
      <div className="grid grid-cols-2 gap-2">
        {previewList.map((media, index) => {
          const isLast = index === 3 && hasMore;

          return (
            <div
              key={`${media.url}-${index}`}
              className="relative overflow-hidden rounded-[18px]"
            >
              {media.type === "image" ? (
                <img
                  src={media.url}
                  alt={`${post.title}-${index}`}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <video
                  src={media.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-40 w-full bg-black object-cover"
                />
              )}

              {isLast && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-lg font-black text-white">
                  +{mediaList.length - 4}
                </div>
              )}

              {media.type === "video" && !isLast && (
                <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                  VIDEO
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PostFeed({ posts }: { posts: Post[] }) {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<number[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("be-calm-saved-posts");
    if (raw) {
      try {
        setSavedIds(JSON.parse(raw));
      } catch {
        setSavedIds([]);
      }
    }
  }, []);

  function toggleSave(postId: number) {
    const next = savedIds.includes(postId)
      ? savedIds.filter((id) => id !== postId)
      : [...savedIds, postId];

    setSavedIds(next);
    localStorage.setItem("be-calm-saved-posts", JSON.stringify(next));
  }

  const searchedPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;

    return posts.filter((post) => {
      return (
        post.title?.toLowerCase().includes(q) ||
        post.content?.toLowerCase().includes(q) ||
        post.location?.toLowerCase().includes(q) ||
        post.place_name?.toLowerCase().includes(q) ||
        post.category?.toLowerCase().includes(q)
      );
    });
  }, [posts, query]);

  const savedPosts = useMemo(() => {
    return posts.filter((post) => savedIds.includes(post.id));
  }, [posts, savedIds]);

  const displayPosts =
    activeTab === "saved"
      ? savedPosts
      : activeTab === "search"
      ? searchedPosts
      : posts;

  return (
    <>
      {activeTab === "search" && (
        <section className="mb-5">
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋店家、地點、標題、內容..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />
          </div>
        </section>
      )}

      <section className="mb-24 space-y-5">
        {displayPosts.length === 0 ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            {activeTab === "saved"
              ? "你目前還沒有收藏貼文"
              : activeTab === "search"
              ? "找不到符合的內容"
              : "目前還沒有貼文，來發第一篇吧。"}
          </div>
        ) : (
          displayPosts.map((post, index) => {
            const isSaved = savedIds.includes(post.id);

            return (
              <article
                id={`post-${post.id}`}
                key={post.id}
                className={`scroll-mt-28 overflow-hidden rounded-[28px] border border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  index % 2 === 0 ? "bg-white" : "bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 via-orange-400 to-fuchsia-500 text-sm font-bold text-white">
                      坑
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {post.place_name || post.location || "匿名避坑人"}
                      </div>

                      <div className="text-xs text-slate-500">
                        {formatDate(post.created_at)}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleSave(post.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      isSaved
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isSaved ? "已收藏" : "收藏"}
                  </button>
                </div>

                <MediaGrid post={post} />

                <div className="px-5 py-5">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      {post.category}
                    </span>

                    {post.location && (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                        {post.location}
                      </span>
                    )}

                    {post.google_maps_url && (
                      <a
                        href={post.google_maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                      >
                        📍 Google 店家
                      </a>
                    )}

                    {post.external_url && (
                      <a
                        href={post.external_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700"
                      >
                        {getExternalLabel(post)}
                      </a>
                    )}
                  </div>

                  <h2 className="text-2xl font-black text-slate-900">
                    {post.title}
                  </h2>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {post.content}
                  </p>

                  <PostActions postId={post.id} />
                </div>
              </article>
            );
          })
        )}
      </section>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </>
  );
}