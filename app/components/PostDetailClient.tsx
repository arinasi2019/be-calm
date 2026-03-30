"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PostActions from "./PostActions";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";

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
  updated_at?: string | null;
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
  hashtags?: string[] | null;
  author_profile?: Profile | null;
  pitCount?: number;
  commentCount?: number;
};

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
  return post.hashtags.filter(Boolean).slice(0, 10);
}

function ShareButtons({ post }: { post: Post }) {
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/post/${post.id}`
      : `/post/${post.id}`;

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
        alert("文章連結已複製");
      }
    } catch {}
  }

  return (
    <button
      onClick={handleShare}
      className="text-sm font-medium text-slate-500 hover:text-slate-900"
    >
      分享文章
    </button>
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
      <div className="pt-2">
        <div className="overflow-hidden rounded-[22px]">
          {media.type === "image" ? (
            <img
              src={media.url}
              alt={post.title}
              className="h-72 w-full cursor-zoom-in object-cover"
              onClick={() => onOpenMedia(mediaList, 0)}
            />
          ) : (
            <video
              src={media.url}
              controls
              playsInline
              preload="metadata"
              className="h-72 w-full bg-black object-cover"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-xs font-medium text-slate-500">共 {mediaList.length} 項媒體</div>
        <div className="text-[11px] text-slate-400">左右滑動查看更多 →</div>
      </div>

      <div className="-mx-1 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-3 px-1">
          {mediaList.map((media, index) => (
            <div
              key={`${media.url}-${index}`}
              className="relative w-[85%] shrink-0 snap-center overflow-hidden rounded-[20px] sm:w-[320px]"
            >
              {media.type === "image" ? (
                <img
                  src={media.url}
                  alt={`${post.title}-${index}`}
                  className="h-64 w-full cursor-zoom-in object-cover"
                  onClick={() => onOpenMedia(mediaList, index)}
                />
              ) : (
                <>
                  <video
                    src={media.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-64 w-full bg-black object-cover"
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

export default function PostDetailClient({ post }: { post: Post }) {
  const router = useRouter();
  const { user } = useAuth();

  const authorName =
    post.author_profile?.display_name ||
    post.author_profile?.username ||
    "匿名使用者";

  const displayPlace = post.place_name || post.location || null;
  const isIncidentPost = post.category === "人物/事件" || post.content_type === "incident";
  const hashtagList = getDisplayHashtags(post);

  const [lightboxMedia, setLightboxMedia] = useState<MediaItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const isOwner = Boolean(user?.id && post.user_id && user.id === post.user_id);

  useEffect(() => {
    async function loadSavedState() {
      if (!user) {
        setIsSaved(false);
        setSaveLoading(false);
        return;
      }

      setSaveLoading(true);

      const { data, error } = await supabase
        .from("saved_posts")
        .select("post_id")
        .eq("user_id", user.id)
        .eq("post_id", post.id)
        .maybeSingle();

      if (error) {
        console.error("載入收藏狀態失敗：", error.message);
        setIsSaved(false);
        setSaveLoading(false);
        return;
      }

      setIsSaved(!!data);
      setSaveLoading(false);
    }

    loadSavedState();
  }, [user, post.id]);

  async function toggleSave() {
    if (!user) {
      router.push("/login");
      return;
    }

    if (saveLoading) return;

    setSaveLoading(true);

    if (isSaved) {
      setIsSaved(false);

      const { error } = await supabase
        .from("saved_posts")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", post.id);

      if (error) {
        console.error("取消收藏失敗：", error.message);
        setIsSaved(true);
      }

      setSaveLoading(false);
      return;
    }

    setIsSaved(true);

    const { error } = await supabase.from("saved_posts").insert([
      {
        user_id: user.id,
        post_id: post.id,
      },
    ]);

    if (error) {
      console.error("收藏失敗：", error.message);
      setIsSaved(false);
    }

    setSaveLoading(false);
  }

  async function handleDelete() {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!isOwner) {
      alert("你沒有刪除這篇貼文的權限");
      return;
    }

    const confirmed = window.confirm("確定要刪除這篇貼文嗎？刪除後無法恢復。");
    if (!confirmed) return;

    setDeleting(true);

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", user.id);

    setDeleting(false);

    if (error) {
      alert("刪除失敗：" + error.message);
      return;
    }

    alert("貼文已刪除");
    router.push("/profile");
    router.refresh();
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

  return (
    <>
      <main className="min-h-screen bg-slate-100 text-slate-900">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              ← 回首頁
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {isOwner && (
                <>
                  <Link
                    href={`/edit/${post.id}`}
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    編輯
                  </Link>

                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-full bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200 disabled:opacity-60"
                  >
                    {deleting ? "刪除中..." : "刪除"}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={toggleSave}
                disabled={saveLoading}
                className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ${
                  isSaved
                    ? "bg-amber-100 text-amber-700 ring-amber-200"
                    : "bg-white text-slate-700 ring-slate-200"
                } disabled:opacity-60`}
              >
                {isSaved ? "已收藏" : "收藏"}
              </button>
            </div>
          </div>

          <article
            className={`rounded-[28px] border bg-white p-5 shadow-sm ${
              isIncidentPost ? "border-rose-200" : "border-slate-200"
            }`}
          >
            <div className="mt-3 flex flex-wrap gap-2">
              {getCategoryBadge(post)}

              {formatLocation(post) && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
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
              <div className="mt-3 flex flex-wrap gap-2">
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

            <h1 className="mt-4 text-3xl font-black leading-tight text-slate-900">
              {post.title}
            </h1>

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
              <span>作者：{authorName}</span>
              <span>發佈：{formatDateTime(post.published_at || post.created_at)}</span>
              {post.updated_at && (
                <span>最後更新：{formatDateTime(post.updated_at)}</span>
              )}
            </div>

            {displayPlace && (
              <div className="mt-4 text-sm font-semibold text-slate-800">
                {displayPlace}
              </div>
            )}

            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {post.content}
            </div>

            {hashtagList.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
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

            <div className="mt-4 flex items-center gap-4">
              <ShareButtons post={post} />
            </div>

            <PostActions postId={post.id} />
          </article>
        </div>
      </main>

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