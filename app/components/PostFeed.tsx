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
  if (post.image_url) fallback.push({ type: "image", url: post.image_url });
  if (post.video_url) fallback.push({ type: "video", url: post.video_url });
  return fallback;
}

function Lightbox({
  mediaList,
  currentIndex,
  onClose,
  onPrev,
  onNext,
  onJump,
}: {
  mediaList: MediaItem[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext]);

  if (!mediaList.length) return null;
  const current = mediaList[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black/90" onClick={onClose}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur"
      >
        關閉
      </button>

      {mediaList.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-white backdrop-blur"
        >
          ←
        </button>
      )}

      {mediaList.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-white backdrop-blur"
        >
          →
        </button>
      )}

      <div
        className="flex h-full flex-col items-center justify-center px-4 pb-6 pt-16"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center">
          {current.type === "image" ? (
            <img
              src={current.url}
              alt={`preview-${currentIndex}`}
              className="max-h-[72vh] max-w-full rounded-2xl object-contain"
            />
          ) : (
            <video
              src={current.url}
              controls
              playsInline
              preload="metadata"
              className="max-h-[72vh] max-w-full rounded-2xl bg-black object-contain"
            />
          )}
        </div>

        {mediaList.length > 1 && (
          <>
            <div className="mt-3 text-center text-sm text-white/80">
              {currentIndex + 1} / {mediaList.length}
            </div>

            <div className="mt-4 w-full max-w-4xl overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-2">
                {mediaList.map((media, index) => (
                  <button
                    key={`${media.url}-${index}`}
                    onClick={() => onJump(index)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                      currentIndex === index ? "border-white" : "border-white/20"
                    }`}
                  >
                    {media.type === "image" ? (
                      <img
                        src={media.url}
                        alt={`thumb-${index}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        <video
                          src={media.url}
                          className="h-full w-full bg-black object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-[10px] font-bold text-white">
                          VIDEO
                        </div>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MediaRail({
  post,
  onOpenMedia,
}: {
  post: Post;
  onOpenMedia: (mediaList: MediaItem[], index: number) => void;
}) {
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
              className="h-56 w-full cursor-zoom-in object-cover"
              onClick={() => onOpenMedia(mediaList, 0)}
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

  return (
    <div className="px-5 pt-2">
      <div className="overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid auto-cols-[calc(50%-0.25rem)] grid-flow-col gap-2">
          {mediaList.map((media, index) => (
            <div
              key={`${media.url}-${index}`}
              className="relative overflow-hidden rounded-[18px]"
            >
              {media.type === "image" ? (
                <img
                  src={media.url}
                  alt={`${post.title}-${index}`}
                  className="h-44 w-full cursor-zoom-in object-cover"
                  onClick={() => onOpenMedia(mediaList, index)}
                />
              ) : (
                <>
                  <video
                    src={media.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-44 w-full bg-black object-cover"
                  />
                  <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                    VIDEO
                  </div>
                </>
              )}

              {index === 1 && mediaList.length > 2 && (
                <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">
                  還有 {mediaList.length - 2} 項 →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShareButtons({ post }: { post: Post }) {
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/#post-${post.id}`
      : `#post-${post.id}`;

  const shareText = `${post.title}｜避坑 Be Calm`;

  async function handleNativeShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareText,
          text: post.content.slice(0, 60),
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("連結已複製");
      }
    } catch {}
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("連結已複製");
    } catch {
      alert("複製失敗");
    }
  }

  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(
    shareUrl
  )}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText
  )}&url=${encodeURIComponent(shareUrl)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    shareUrl
  )}`;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        onClick={handleNativeShare}
        className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
      >
        分享
      </button>

      <button
        onClick={handleCopy}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
      >
        複製連結
      </button>

      <a
        href={lineUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700"
      >
        LINE
      </a>

      <a
        href={xUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
      >
        X
      </a>

      <a
        href={fbUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
      >
        Facebook
      </a>
    </div>
  );
}

export default function PostFeed({ posts }: { posts: Post[] }) {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [lightboxMedia, setLightboxMedia] = useState<MediaItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(6);

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

  useEffect(() => {
    function onScroll() {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 800;

      if (nearBottom) {
        setVisibleCount((prev) => prev + 4);
      }
    }

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleSave(postId: number) {
    const next = savedIds.includes(postId)
      ? savedIds.filter((id) => id !== postId)
      : [...savedIds, postId];

    setSavedIds(next);
    localStorage.setItem("be-calm-saved-posts", JSON.stringify(next));
  }

  function openLightbox(mediaList: MediaItem[], index: number) {
    if (!mediaList.length) return;
    setLightboxMedia(mediaList);
    setLightboxIndex(index);
  }

  function closeLightbox() {
    setLightboxMedia([]);
    setLightboxIndex(0);
  }

  function showPrevMedia() {
    setLightboxIndex((prev) =>
      prev === 0 ? lightboxMedia.length - 1 : prev - 1
    );
  }

  function showNextMedia() {
    setLightboxIndex((prev) =>
      prev === lightboxMedia.length - 1 ? 0 : prev + 1
    );
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

  const sourcePosts =
    activeTab === "saved"
      ? savedPosts
      : activeTab === "search"
      ? searchedPosts
      : posts;

  const displayPosts = sourcePosts.slice(0, visibleCount);

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
          <>
            {displayPosts.map((post, index) => {
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

                  <MediaRail post={post} onOpenMedia={openLightbox} />

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

                    <ShareButtons post={post} />

                    <PostActions postId={post.id} />
                  </div>
                </article>
              );
            })}

            {displayPosts.length < sourcePosts.length && (
              <div className="text-center text-sm text-slate-500">
                往下滑可載入更多內容
              </div>
            )}
          </>
        )}
      </section>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />

      {lightboxMedia.length > 0 && (
        <Lightbox
          mediaList={lightboxMedia}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={showPrevMedia}
          onNext={showNextMedia}
          onJump={setLightboxIndex}
        />
      )}
    </>
  );
}