"use client";

import { useEffect, useMemo, useState } from "react";
import PostActions from "./PostActions";
import BottomNav from "./BottomNav";

type MediaItem = {
  type: "image" | "video";
  url: string;
};

type RiskLevel = "低" | "中" | "高";

type Post = {
  id: number;
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
};

type TabType = "home" | "search" | "saved";

function formatDateTime(dateString: string | null) {
  if (!dateString) return "未知時間";

  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "未知時間";

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function getCountryFlag(country?: string | null) {
  if (!country) return "";
  if (country === "台灣") return "🇹🇼";
  if (country === "日本") return "🇯🇵";
  if (country === "韓國") return "🇰🇷";
  if (country === "泰國") return "🇹🇭";
  if (country === "香港") return "🇭🇰";
  if (country === "新加坡") return "🇸🇬";
  if (country === "澳洲") return "🇦🇺";
  return "🌍";
}

function formatLocation(post: Post) {
  const parts = [post.country, post.city || post.location].filter(Boolean);
  return parts.join(" · ");
}

function getExternalLabel(post: Post) {
  if (post.category === "商品") return "🛒 商品連結";
  if (post.category === "旅遊") return "🗺 相關資訊";
  if (post.category === "服務") return "🔗 官方網站";
  if (post.category === "人物/事件") return "⚠ 事件資訊";
  return "🔗 相關連結";
}

function getMediaList(post: Post): MediaItem[] {
  if (post.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
    return [...post.media_urls].sort((a, b) => {
      if (a.type === "video" && b.type !== "video") return -1;
      if (a.type !== "video" && b.type === "video") return 1;
      return 0;
    });
  }

  const fallback: MediaItem[] = [];

  if (post.video_url) {
    fallback.push({ type: "video", url: post.video_url });
  }

  if (post.image_url) {
    fallback.push({ type: "image", url: post.image_url });
  }

  return fallback;
}

function getRiskBadgeClass(riskLevel?: RiskLevel | null) {
  if (riskLevel === "高") return "border-rose-200 bg-rose-50 text-rose-700";
  if (riskLevel === "中") return "border-amber-200 bg-amber-50 text-amber-700";
  if (riskLevel === "低") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getCategoryBadge(post: Post) {
  if (post.category === "人物/事件") {
    return (
      <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white">
        ⚠ 人物 / 事件
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
      {post.category}
    </span>
  );
}

function ShareButtons({ post }: { post: Post }) {
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/#post-${post.id}`
      : `/#post-${post.id}`;

  const shareText = `${post.title}｜避坑 Be Calm`;

  async function handleShare() {
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

  return (
    <div className="mt-4">
      <button
        onClick={handleShare}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M12 16V4" />
          <path d="M8 8l4-4 4 4" />
          <path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2" />
        </svg>
        分享
      </button>
    </div>
  );
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
        <div className="mx-auto max-w-[520px] overflow-hidden rounded-[22px]">
          {media.type === "image" ? (
            <img
              src={media.url}
              alt={post.title}
              className="h-64 w-full cursor-zoom-in object-cover"
              onClick={() => onOpenMedia(mediaList, 0)}
            />
          ) : (
            <video
              src={media.url}
              controls
              playsInline
              preload="metadata"
              className="h-64 w-full bg-black object-cover"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-xs font-medium text-slate-500">共 {mediaList.length} 項媒體</div>
        <div className="text-[11px] text-slate-400">左右滑動查看更多 →</div>
      </div>

      <div className="-mx-1 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-3 px-1">
          {mediaList.map((media, index) => (
            <div
              key={`${media.url}-${index}`}
              className="relative w-[82%] shrink-0 snap-center overflow-hidden rounded-[20px] sm:w-[240px]"
            >
              {media.type === "image" ? (
                <img
                  src={media.url}
                  alt={`${post.title}-${index}`}
                  className="h-48 w-full cursor-zoom-in object-cover"
                  onClick={() => onOpenMedia(mediaList, index)}
                />
              ) : (
                <>
                  <video
                    src={media.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-48 w-full bg-black object-cover"
                  />
                  <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                    VIDEO
                  </div>
                </>
              )}

              <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">
                {index + 1} / {mediaList.length}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchModal({
  query,
  setQuery,
  results,
  onClose,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: Post[];
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-16 max-w-2xl rounded-[28px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋店家、商品、地點、標題、內容、事件類型..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />

            <button
              onClick={onClose}
              className="shrink-0 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
            >
              關閉
            </button>
          </div>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-4">
          {query.trim() === "" ? (
            <div className="py-10 text-center text-sm text-slate-400">輸入關鍵字開始搜尋</div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">找不到符合的內容</div>
          ) : (
            <div className="space-y-3">
              {results.map((post) => (
                <a
                  key={post.id}
                  href={`#post-${post.id}`}
                  onClick={onClose}
                  className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-bold text-slate-900">{post.title}</div>

                    {post.category === "人物/事件" && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                        人物 / 事件
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {post.place_name || post.location || post.category}
                    {post.incident_type ? ` · ${post.incident_type}` : ""}
                  </div>

                  <div className="mt-2 line-clamp-2 text-sm text-slate-600">{post.content}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PostFeed({ posts }: { posts: Post[] }) {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [expandedPostIds, setExpandedPostIds] = useState<number[]>([]);
  const [lightboxMedia, setLightboxMedia] = useState<MediaItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(6);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hasHandledHashScroll, setHasHandledHashScroll] = useState(false);

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
    let ticking = false;

    function onScroll() {
      if (ticking) return;

      ticking = true;

      requestAnimationFrame(() => {
        const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 800;
        if (nearBottom) setVisibleCount((prev) => prev + 4);
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const searchedPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return posts.filter((post) => {
      return (
        post.title?.toLowerCase().includes(q) ||
        post.content?.toLowerCase().includes(q) ||
        (post.location || "").toLowerCase().includes(q) ||
        (post.place_name || "").toLowerCase().includes(q) ||
        post.category?.toLowerCase().includes(q) ||
        (post.country || "").toLowerCase().includes(q) ||
        (post.city || "").toLowerCase().includes(q) ||
        (post.incident_type || "").toLowerCase().includes(q)
      );
    });
  }, [posts, query]);

  const savedPosts = useMemo(() => posts.filter((post) => savedIds.includes(post.id)), [posts, savedIds]);

  const sourcePosts = activeTab === "saved" ? savedPosts : posts;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash.startsWith("#post-")) return;

    const id = Number(hash.replace("#post-", ""));
    if (!id) return;

    const index = sourcePosts.findIndex((post) => post.id === id);
    if (index >= 0) {
      setVisibleCount((prev) => Math.max(prev, index + 1));
    }
  }, [sourcePosts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasHandledHashScroll) return;

    const hash = window.location.hash;
    if (!hash.startsWith("#post-")) return;

    const timer = setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setHasHandledHashScroll(true);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [sourcePosts, visibleCount, hasHandledHashScroll]);

  function handleTabChange(tab: TabType) {
    if (tab === "search") {
      setSearchOpen(true);
      setActiveTab("home");
      return;
    }
    setActiveTab(tab);
  }

  function toggleSave(postId: number) {
    const next = savedIds.includes(postId)
      ? savedIds.filter((id) => id !== postId)
      : [...savedIds, postId];

    setSavedIds(next);
    localStorage.setItem("be-calm-saved-posts", JSON.stringify(next));
  }

  function toggleExpand(postId: number) {
    setExpandedPostIds((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
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
    setLightboxIndex((prev) => (prev === 0 ? lightboxMedia.length - 1 : prev - 1));
  }

  function showNextMedia() {
    setLightboxIndex((prev) => (prev === lightboxMedia.length - 1 ? 0 : prev + 1));
  }

  const displayPosts = sourcePosts.slice(0, visibleCount);

  return (
    <>
      <section className="mb-24 space-y-5">
        {displayPosts.length === 0 ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            {activeTab === "saved" ? "你目前還沒有收藏貼文" : "目前還沒有貼文，來發第一篇吧。"}
          </div>
        ) : (
          <>
            {displayPosts.map((post, index) => {
              const isSaved = savedIds.includes(post.id);
              const isIncidentPost = post.category === "人物/事件" || post.content_type === "incident";
              const isExpanded = expandedPostIds.includes(post.id);
              const shouldTruncate = post.content.length > 140;

              return (
                <article
                  id={`post-${post.id}`}
                  key={post.id}
                  className={`scroll-mt-28 overflow-hidden rounded-[28px] border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    isIncidentPost
                      ? "border-rose-200 bg-rose-50/30"
                      : index % 2 === 0
                      ? "border-slate-200 bg-white"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ${
                          isIncidentPost
                            ? "bg-gradient-to-br from-rose-500 via-red-500 to-orange-500"
                            : "bg-gradient-to-br from-rose-400 via-orange-400 to-fuchsia-500"
                        }`}
                      >
                        {isIncidentPost ? "警" : "坑"}
                      </div>

                      <div>
                        <div className="text-[15px] font-semibold text-slate-900">
                          {post.place_name || post.location || (isIncidentPost ? "匿名事件分享" : "匿名避坑人")}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">發布時間：{formatDateTime(post.created_at)}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleSave(post.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        isSaved ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isSaved ? "已收藏" : "收藏"}
                    </button>
                  </div>

                  <MediaRail post={post} onOpenMedia={openLightbox} />

                  <div className="px-5 py-5">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {getCategoryBadge(post)}

                      {formatLocation(post) && (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                          {getCountryFlag(post.country)} {formatLocation(post)}
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
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isIncidentPost
                              ? "border border-rose-200 bg-rose-50 text-rose-700"
                              : "border border-sky-200 bg-sky-50 text-sky-700"
                          }`}
                        >
                          {getExternalLabel(post)}
                        </a>
                      )}
                    </div>

                    {isIncidentPost && (post.incident_type || post.risk_level) && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {post.incident_type && (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                            類型：{post.incident_type}
                          </span>
                        )}

                        {post.risk_level && (
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${getRiskBadgeClass(
                              post.risk_level
                            )}`}
                          >
                            風險：{post.risk_level}
                          </span>
                        )}
                      </div>
                    )}

                    <h2 className="text-2xl font-black text-slate-900">{post.title}</h2>

                    <div className="mt-3">
                      <p
                        className={`whitespace-pre-wrap text-sm leading-7 text-slate-700 ${
                          !isExpanded && shouldTruncate ? "line-clamp-4" : ""
                        }`}
                      >
                        {post.content}
                      </p>

                      {shouldTruncate && (
                        <button
                          onClick={() => toggleExpand(post.id)}
                          className="mt-2 text-sm font-medium text-slate-500 hover:text-slate-900"
                        >
                          {isExpanded ? "收起" : "繼續閱讀"}
                        </button>
                      )}
                    </div>

                    <ShareButtons post={post} />
                    <PostActions postId={post.id} />
                  </div>
                </article>
              );
            })}

            {displayPosts.length < sourcePosts.length && (
              <div className="text-center text-sm text-slate-500">往下滑可載入更多內容</div>
            )}
          </>
        )}
      </section>

      <BottomNav activeTab={activeTab} onChange={handleTabChange} />

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

      {searchOpen && (
        <SearchModal
          query={query}
          setQuery={setQuery}
          results={searchedPosts}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </>
  );
}