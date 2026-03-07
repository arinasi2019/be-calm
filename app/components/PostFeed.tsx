"use client";

import { useEffect, useState } from "react";

type MediaItem = {
  url: string;
  type: "image" | "video";
};

type Post = {
  id: number;
  title: string;
  category: string;
  country?: string | null;
  city?: string | null;
  location?: string | null;
  content: string;
  created_at: string | null;
  media_urls?: MediaItem[] | null;
  google_maps_url?: string | null;
  external_url?: string | null;
  place_name?: string | null;
};

export default function PostFeed({ posts }: { posts: Post[] }) {
  const [visibleCount, setVisibleCount] = useState(6);
  const [savedPosts, setSavedPosts] = useState<number[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [hasHandledHashScroll, setHasHandledHashScroll] = useState(false);

  const displayPosts = posts
    .filter((p) =>
      p.title.toLowerCase().includes(searchText.toLowerCase())
    )
    .slice(0, visibleCount);

  useEffect(() => {
    const onScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 800
      ) {
        setVisibleCount((v) => v + 6);
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasHandledHashScroll) return;

    const hash = window.location.hash;
    if (!hash.startsWith("#post-")) return;

    const timer = setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHasHandledHashScroll(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [posts, hasHandledHashScroll]);

  function toggleSave(id: number) {
    if (savedPosts.includes(id)) {
      setSavedPosts(savedPosts.filter((p) => p !== id));
    } else {
      setSavedPosts([...savedPosts, id]);
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "";
    return new Date(date).toLocaleDateString("zh-TW");
  }

  function getFlag(country?: string | null) {
    if (!country) return "";
    if (country === "台灣") return "🇹🇼";
    if (country === "日本") return "🇯🇵";
    if (country === "韓國") return "🇰🇷";
    if (country === "泰國") return "🇹🇭";
    return "🌍";
  }

  function formatLocation(post: Post) {
    const parts = [post.country, post.city || post.location].filter(Boolean);
    return parts.join(" · ");
  }

  return (
    <div className="mx-auto max-w-2xl pb-32">
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => setSearchOpen(true)}
          className="rounded-full bg-black px-5 py-3 text-white shadow-lg"
        >
          搜尋
        </button>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <input
              placeholder="搜尋貼文..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full rounded-lg border p-3"
            />

            <button
              onClick={() => setSearchOpen(false)}
              className="mt-4 w-full rounded-lg bg-black py-2 text-white"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {displayPosts.map((post) => {
        const isSaved = savedPosts.includes(post.id);

        return (
          <div
            key={post.id}
            id={`post-${post.id}`}
            className="mb-10 rounded-2xl border bg-white shadow-sm"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 text-white font-bold">
                  坑
                </div>

                <div>
                  <div className="font-semibold text-slate-900">
                    {post.place_name || post.location || "匿名避坑人"}
                  </div>

                  <div className="text-xs text-slate-500">
                    發布時間：{formatDate(post.created_at)}
                  </div>
                </div>
              </div>

              <button
                onClick={() => toggleSave(post.id)}
                className={`rounded-full px-3 py-1 text-xs ${
                  isSaved ? "bg-yellow-100 text-yellow-700" : "bg-gray-100"
                }`}
              >
                {isSaved ? "已收藏" : "收藏"}
              </button>
            </div>

            {post.media_urls && post.media_urls.length > 0 && (
              <div className="overflow-x-auto snap-x snap-mandatory flex gap-3 px-5 pb-4">
                {post.media_urls.map((m, i) => (
                  <div
                    key={i}
                    className="snap-center min-w-[80%] overflow-hidden rounded-xl"
                  >
                    {m.type === "image" ? (
                      <img
                        src={m.url}
                        className="h-[300px] w-full object-cover"
                      />
                    ) : (
                      <video
                        src={m.url}
                        controls
                        className="h-[300px] w-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="px-5 pb-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-black px-3 py-1 text-xs text-white">
                {post.category}
              </span>

              {formatLocation(post) && (
                <span className="rounded-full border px-3 py-1 text-xs">
                  {getFlag(post.country)} {formatLocation(post)}
                </span>
              )}

              {post.google_maps_url && (
                <a
                  href={post.google_maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs"
                >
                  📍 Google 店家
                </a>
              )}
            </div>

            <div className="px-5 pb-3 text-xl font-bold">{post.title}</div>

            <div className="px-5 pb-5 text-sm text-slate-700">
              {post.content}
            </div>

            <div className="flex justify-end px-5 pb-5">
              <button
                onClick={() => {
                  const url =
                    window.location.origin + "/#" + "post-" + post.id;
                  navigator.clipboard.writeText(url);
                  alert("分享連結已複製");
                }}
                className="text-sm text-blue-600"
              >
                分享
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}