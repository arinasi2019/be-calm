"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PostActions from "./PostActions";
import BottomNav from "./BottomNav";
import { useAuth } from "./AuthProvider";
import { supabase } from "../lib/supabase";

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
  author_profile?: Profile | null;
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
  hashtags?: string[] | null;
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
  if (post.video_url) fallback.push({ type: "video", url: post.video_url });
  if (post.image_url) fallback.push({ type: "image", url: post.image_url });

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

function getAuthorName(post: Post) {
  if (post.is_seed && post.seed_author_name?.trim()) {
    return post.seed_author_name.trim();
  }

  const profile = post.author_profile;
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  if (profile?.username?.trim()) return profile.username.trim();
  if (profile?.email?.trim()) return profile.email.split("@")[0];
  return "會員";
}

function getAuthorInitial(post: Post) {
  return getAuthorName(post).slice(0, 1).toUpperCase();
}

function formatPrice(price?: number | null, country?: string | null) {
  if (price == null || Number.isNaN(price)) return null;
  if (country === "日本") return `¥${price.toLocaleString("ja-JP")} 起`;
  if (country === "台灣") return `NT$${price.toLocaleString("zh-TW")} 起`;
  if (country === "澳洲") return `A$${price.toLocaleString("en-AU")} 起`;
  return `$${price.toLocaleString()} 起`;
}

function shouldShowTrySection(post: Post) {
  return Boolean(post.can_try || post.booking_url);
}

function getTryHref(post: Post) {
  if (post.booking_url) return post.booking_url;
  return `/try/${post.id}`;
}

function getTryButtonLabel(post: Post) {
  return post.try_button_label?.trim() || "親自踩坑";
}

function getPitfallSummary(post: Post) {
  if (Array.isArray(post.pitfall_summary) && post.pitfall_summary.length > 0) {
    return post.pitfall_summary.filter(Boolean).slice(0, 3);
  }

  const items: string[] = [];
  if (post.risk_level === "高") items.push("風險偏高，建議先看清楚內容");
  if (post.risk_level === "中") items.push("評價偏兩極，建議先自行判斷");
  if (post.google_maps_url) items.push("可先查看 Google 店家資訊");
  if (post.external_url && post.category === "商品") items.push("購買前建議先比價");
  if (post.external_url && post.category === "旅遊") items.push("預訂前建議再確認細節");

  return items.slice(0, 3);
}

function getDisplayHashtags(post: Post) {
  if (!Array.isArray(post.hashtags)) return [];
  return post.hashtags.filter(Boolean).slice(0, 6);
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
      <div className="mt-4">
        <div className="overflow-hidden rounded-[24px] bg-slate-100 ring-1 ring-slate-200">
          {media.type === "image" ? (
            <img
              src={media.url}
              alt={post.place_name || post.title}
              className="block h-[320px] w-full cursor-zoom-in object-cover sm:h-[420px] lg:h-[520px]"
              onClick={() => onOpenMedia(mediaList, 0)}
            />
          ) : (
            <video
              src={media.url}
              controls
              playsInline
              preload="metadata"
              className="block h-[320px] w-full bg-black object-cover sm:h-[420px] lg:h-[520px]"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-xs font-medium text-slate-500">共 {mediaList.length} 項媒體</div>
        <div className="text-[11px] text-slate-400">左右滑動查看更多 →</div>
      </div>

      <div className="-mx-1 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-3 px-1">
          {mediaList.map((media, index) => (
            <div
              key={`${media.url}-${index}`}
              className="relative w-[86%] shrink-0 snap-center overflow-hidden rounded-[22px] bg-slate-100 sm:w-[360px]"
            >
              {media.type === "image" ? (
                <img
                  src={media.url}
                  alt={`${post.place_name || post.title}-${index}`}
                  className="h-72 w-full cursor-zoom-in object-cover sm:h-80"
                  onClick={() => onOpenMedia(mediaList, index)}
                />
              ) : (
                <>
                  <video
                    src={media.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-72 w-full bg-black object-cover sm:h-80"
                  />
                  <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white">
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
    <div className="fixed inset-0 z-50 bg-black/35 px-4 pb-4 pt-24 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-2xl rounded-[28px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋店家、商品、地點、標題、內容、hashtag、事件類型..."
              className="min-w-0 w-full max-w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"
            />

            <button
              onClick={onClose}
              className="shrink-0 rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-600"
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
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  onClick={onClose}
                  className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-bold text-slate-900">
                      {post.place_name || post.title}
                    </div>

                    {post.category === "人物/事件" && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                        人物 / 事件
                      </span>
                    )}
                  </div>

                  {post.place_name && post.title && (
                    <div className="mt-1 text-sm text-slate-700">{post.title}</div>
                  )}

                  <div className="mt-1 text-xs text-slate-500">作者：{getAuthorName(post)}</div>

                  <div className="mt-1 text-xs text-slate-500">
                    {post.location || post.category}
                    {post.incident_type ? ` · ${post.incident_type}` : ""}
                  </div>

                  {getDisplayHashtags(post).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getDisplayHashtags(post).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] text-sky-700"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 line-clamp-2 text-sm text-slate-600">{post.content}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
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

function TrySection({ post }: { post: Post }) {
  if (!shouldShowTrySection(post)) return null;

  const summaryItems = getPitfallSummary(post);
  const tryHref = getTryHref(post);
  const priceText = formatPrice(post.price_from, post.country);
  const buttonLabel = getTryButtonLabel(post);
  const isExternal = Boolean(post.booking_url);

  return (
    <div className="mt-5 rounded-[24px] border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">
              親自踩坑
            </span>

            {priceText && (
              <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700">
                {priceText}
              </span>
            )}
          </div>

          <div className="mt-3 text-sm font-semibold text-slate-900">
            看完避坑提醒，還是想自己試試？
          </div>

          <div className="mt-1 text-sm leading-6 text-slate-600">
            你可以先看清楚風險，再決定要不要親自踩坑。
          </div>

          {summaryItems.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {summaryItems.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs text-slate-700"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0">
          {isExternal ? (
            <a
              href={tryHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
            >
              {buttonLabel}
            </a>
          ) : (
            <Link
              href={tryHref}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
            >
              {buttonLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PostFeed({ posts }: { posts: Post[] }) {
  const router = useRouter();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hasHandledHashScroll, setHasHandledHashScroll] = useState(false);

  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);

  const [lightboxMedia, setLightboxMedia] = useState<MediaItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [expandedPostIds, setExpandedPostIds] = useState<number[]>([]);

  const feedRef = useRef<HTMLElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const PULL_THRESHOLD = 72;

  useEffect(() => {
    function handleOpenSearch() {
      setSearchOpen(true);
      setActiveTab("home");
    }

    window.addEventListener("becalm-open-search", handleOpenSearch);

    return () => {
      window.removeEventListener("becalm-open-search", handleOpenSearch);
    };
  }, []);

  useEffect(() => {
    async function loadSavedPosts() {
      if (!user) {
        setSavedIds([]);
        setSavedLoading(false);
        return;
      }

      setSavedLoading(true);

      const { data, error } = await supabase
        .from("saved_posts")
        .select("post_id")
        .eq("user_id", user.id);

      if (error) {
        console.error("載入收藏失敗：", error.message);
        setSavedIds([]);
        setSavedLoading(false);
        return;
      }

      const ids = ((data ?? []) as { post_id: number }[]).map((item) => item.post_id);
      setSavedIds(ids);
      setSavedLoading(false);
    }

    loadSavedPosts();
  }, [user]);

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
      const authorName = getAuthorName(post).toLowerCase();
      const searchName = (post.place_name || "").toLowerCase();

      return (
        searchName.includes(q) ||
        post.title?.toLowerCase().includes(q) ||
        post.content?.toLowerCase().includes(q) ||
        (post.location || "").toLowerCase().includes(q) ||
        post.category?.toLowerCase().includes(q) ||
        (post.country || "").toLowerCase().includes(q) ||
        (post.city || "").toLowerCase().includes(q) ||
        (post.incident_type || "").toLowerCase().includes(q) ||
        authorName.includes(q) ||
        (post.hashtags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [posts, query]);

  const savedPosts = useMemo(() => {
    return posts.filter((post) => savedIds.includes(post.id));
  }, [posts, savedIds]);

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

    if (tab === "saved" && !user) {
      alert("請先登入後再查看收藏");
      router.push("/login");
      return;
    }

    setActiveTab(tab);
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

  function handleTouchStart(e: React.TouchEvent<HTMLElement>) {
    if (window.scrollY > 0 || searchOpen || isRefreshing) return;
    touchStartYRef.current = e.touches[0].clientY;
  }

  function handleTouchMove(e: React.TouchEvent<HTMLElement>) {
    if (touchStartYRef.current == null || window.scrollY > 0 || searchOpen || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartYRef.current;

    if (delta <= 0) {
      setPullDistance(0);
      return;
    }

    const limited = Math.min(delta * 0.45, 110);
    setPullDistance(limited);
  }

  function handleTouchEnd() {
    if (searchOpen || isRefreshing) {
      touchStartYRef.current = null;
      setPullDistance(0);
      return;
    }

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);

      setTimeout(() => {
        window.location.reload();
      }, 300);
      return;
    }

    touchStartYRef.current = null;
    setPullDistance(0);
  }

  const displayPosts = sourcePosts.slice(0, visibleCount);

  return (
    <>
      <section
        ref={feedRef}
        className="mb-24 space-y-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: isRefreshing
            ? "transform 0.2s ease"
            : pullDistance > 0
            ? "none"
            : "transform 0.2s ease",
        }}
      >
        <div
          className="pointer-events-none -mb-2 flex h-0 items-end justify-center overflow-visible"
          aria-hidden="true"
        >
          {(pullDistance > 0 || isRefreshing) && (
            <div className="rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
              {isRefreshing
                ? "更新中..."
                : pullDistance >= PULL_THRESHOLD
                ? "放開即可更新"
                : "下拉更新"}
            </div>
          )}
        </div>

        {savedLoading && activeTab === "saved" ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            載入收藏中...
          </div>
        ) : displayPosts.length === 0 ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            {activeTab === "saved"
              ? "你目前還沒有收藏貼文"
              : "目前還沒有貼文，來發第一篇吧。"}
          </div>
        ) : (
          <>
            {displayPosts.map((post) => {
              const isIncidentPost = post.category === "人物/事件" || post.content_type === "incident";
              const isExpanded = expandedPostIds.includes(post.id);
              const shouldTruncate = post.content.length > 160;
              const authorName = getAuthorName(post);
              const displayPlace = post.place_name || post.location || null;
              const hasSubTitle = Boolean(post.place_name && post.title && post.place_name !== post.title);
              const hashtagList = getDisplayHashtags(post);

              return (
                <article
                  id={`post-${post.id}`}
                  key={post.id}
                  className={`overflow-hidden rounded-[30px] border bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6 ${
                    isIncidentPost ? "border-rose-200" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {!post.is_seed && post.author_profile?.avatar_url ? (
                        <img
                          src={post.author_profile.avatar_url}
                          alt={authorName}
                          className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                        />
                      ) : (
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                            isIncidentPost
                              ? "bg-gradient-to-br from-rose-500 via-red-500 to-orange-500"
                              : post.is_seed
                              ? "bg-gradient-to-br from-sky-700 to-cyan-600"
                              : "bg-gradient-to-br from-slate-900 to-slate-700"
                          }`}
                        >
                          {getAuthorInitial(post)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-semibold text-slate-900">
                          {authorName}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{formatDateTime(post.published_at || post.created_at)}</span>

                          {post.is_seed && (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700">
                              平台整理
                            </span>
                          )}

                          {post.is_featured && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                              精選
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {getCategoryBadge(post)}

                    {formatLocation(post) && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                        {getCountryFlag(post.country)} {formatLocation(post)}
                      </span>
                    )}

                    {displayPlace && (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                        📌 {displayPlace}
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

                  <Link href={`/post/${post.id}`} className="mt-4 block">
                    <h2 className="text-[30px] font-black leading-tight tracking-[-0.02em] text-slate-900 hover:text-slate-700 sm:text-[36px]">
                      {post.place_name || post.title}
                    </h2>

                    {hasSubTitle && (
                      <div className="mt-2 text-lg font-semibold leading-7 text-slate-700 sm:text-xl">
                        {post.title}
                      </div>
                    )}
                  </Link>

                  {isIncidentPost && (post.incident_type || post.risk_level) && (
                    <div className="mt-4 flex flex-wrap gap-2">
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

                  <div className="mt-4">
                    <p
                      className={`whitespace-pre-wrap text-sm leading-7 text-slate-700 ${
                        !isExpanded && shouldTruncate ? "line-clamp-5" : ""
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

                  {hashtagList.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {hashtagList.map((tag) => (
                        <Link
                          key={tag}
                          href={`/tag/${encodeURIComponent(tag)}`}
                          className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                        >
                          #{tag}
                        </Link>
                      ))}
                    </div>
                  )}

                  <MediaRail post={post} onOpenMedia={openLightbox} />

                  <TrySection post={post} />

                  <PostActions postId={post.id} />
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