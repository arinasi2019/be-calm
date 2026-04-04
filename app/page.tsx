"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import { supabase } from "./lib/supabase";

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
  place_name?: string | null;
  google_maps_url?: string | null;
  external_url?: string | null;
  media_urls?: MediaItem[] | null;
  incident_type?: string | null;
  risk_level?: RiskLevel | null;
  content_type?: "normal" | "incident" | null;
  author_profile?: Profile | null;
  hashtags?: string[] | null;
};

type CompanionType = "一個人" | "情侶" | "朋友" | "家庭親子" | "長輩同行";

type BookingSuggestion = {
  title: string;
  reason: string;
  href: string;
  buttonLabel: string;
  badge: string;
  sourceLabel?: string;
  image?: string;
  priceFrom?: string;
  duration?: string;
  tag?: string;
};

type BookingCandidate = {
  id: number;
  title: string;
  place_name?: string | null;
  description?: string | null;
  category?: string | null;
  country?: string | null;
  city?: string | null;
  location?: string | null;
  href: string;
  sourceLabel?: string | null;
  image?: string | null;
};

type PlannerResult = {
  summary?: string;
  warnings: string[];
  strategy: string[];
  optimizedPlan: string[];
  bookingSuggestions: BookingSuggestion[];
  dailyPlan: string[];
  content?: string;
};

type BookingTab = "all" | "tickets" | "transfer" | "charter" | "experience";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function parseSpots(input: string) {
  return input
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeArray(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeBookingSuggestions(input: unknown): BookingSuggestion[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;

      const title = String(obj.title ?? "").trim();
      const reason = String(obj.reason ?? "").trim();
      const href = String(obj.href ?? "").trim();
      const buttonLabel = String(obj.buttonLabel ?? "").trim() || "查看方案";
      const badge = String(obj.badge ?? "").trim() || "推薦";
      const sourceLabel = String(obj.sourceLabel ?? "").trim() || undefined;
      const image = String(obj.image ?? "").trim() || undefined;
      const priceFrom = String(obj.priceFrom ?? "").trim() || undefined;
      const duration = String(obj.duration ?? "").trim() || undefined;
      const tag = String(obj.tag ?? "").trim() || undefined;

      if (!title || !reason || !href) return null;

      return {
        title,
        reason,
        href,
        buttonLabel,
        badge,
        sourceLabel,
        image,
        priceFrom,
        duration,
        tag,
      };
    })
    .filter(Boolean) as BookingSuggestion[];
}

function normalizeAIResult(input: unknown): PlannerResult | null {
  if (!input || typeof input !== "object") return null;

  const obj = input as Record<string, unknown>;

  const result: PlannerResult = {
    summary:
      typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim() : undefined,
    warnings: safeArray(obj.warnings),
    strategy: safeArray(obj.strategy),
    optimizedPlan: safeArray(obj.optimizedPlan),
    bookingSuggestions: normalizeBookingSuggestions(obj.bookingSuggestions),
    dailyPlan: safeArray(obj.dailyPlan),
    content:
      typeof obj.content === "string" && obj.content.trim() ? obj.content.trim() : undefined,
  };

  if (
    !result.summary &&
    result.warnings.length === 0 &&
    result.strategy.length === 0 &&
    result.optimizedPlan.length === 0 &&
    result.bookingSuggestions.length === 0 &&
    result.dailyPlan.length === 0 &&
    !result.content
  ) {
    return null;
  }

  return result;
}

function getPostPrimaryActionLink(post: Post) {
  if (post.external_url) return post.external_url;
  if (post.google_maps_url) return post.google_maps_url;
  return `/post/${post.id}`;
}

function getPostActionLabel(post: Post) {
  if (post.external_url) return "查看方案";
  if (post.google_maps_url) return "查看地點";
  return "看避坑文";
}

function buildBookingCandidates(posts: Post[]): BookingCandidate[] {
  return posts
    .filter((post) => Boolean(post.external_url || post.google_maps_url))
    .map((post) => ({
      id: post.id,
      title: post.title,
      place_name: post.place_name || null,
      description: post.content || null,
      category: post.category || null,
      country: post.country || null,
      city: post.city || null,
      location: post.location || null,
      href: getPostPrimaryActionLink(post),
      sourceLabel: post.place_name || post.title,
      image: post.image_url || null,
    }));
}

function buildFallbackPlannerResult(params: {
  destination: string;
  days: string;
  spots: string[];
  companion: CompanionType;
  style: string;
  budget: string;
  mustAvoid: string;
  bookingCandidates: BookingCandidate[];
}): PlannerResult {
  const { destination, days, spots, companion, style, bookingCandidates } = params;

  if (!destination.trim()) {
    return {
      summary: "",
      warnings: [],
      strategy: [],
      optimizedPlan: [],
      bookingSuggestions: [],
      dailyPlan: [],
      content: "",
    };
  }

  const dayCount = Math.max(1, Math.min(Number(days || 3), 6));

  return {
    summary: `${destination} 這趟目前比較像想去清單，還不是一份真正有節奏的旅行版本。先把主區域、節奏和優先預約項目定下來，整體會順很多。`,
    warnings: [
      spots.length > dayCount * 3
        ? "你列的景點偏多，實際走起來很容易因為移動和排隊失控。"
        : "目前沒有特別明顯的大雷，但還是建議先把每天主區域固定。",
      companion === "家庭親子"
        ? "親子行程不要把熱門景點、購物和長距離移動塞同一天。"
        : "不要把所有熱門點都堆在前兩天，後面會比較疲乏。",
      style.includes("輕鬆")
        ? "你偏好輕鬆型節奏，就不適合一天塞太多『順便去一下』的點。"
        : "如果你想看比較多點，也要先接受整體節奏會比較趕。",
    ].filter(Boolean),
    strategy: [
      `這趟 ${destination} 的關鍵不是去更多地方，而是每天都順。`,
      "先定每天主區域，再補咖啡、購物、散步。",
      "先鎖熱門票券和移動骨架，再決定細節。",
    ],
    optimizedPlan: [
      `先把 ${destination} 的景點分成「一定要去」和「有空再去」。`,
      `以 ${days || "這次"} 的天數來看，每天以 1 個主區域 + 1 到 2 個核心點最合理。`,
      "上午排最重要的點，下午排同區散步、購物或休息。",
      "不要晚餐後再跨區，晚上應該收在同一區比較舒服。",
    ],
    dailyPlan: Array.from({ length: dayCount }).map((_, i) =>
      i === 0
        ? `Day ${i + 1}：抵達後先安排同區域輕鬆行程，不要第一天就排最硬的景點。`
        : i === dayCount - 1
        ? `Day ${i + 1}：安排一個主要區域＋收尾購物或散步，避免最後一天跨區來回。`
        : `Day ${i + 1}：上午主景點，下午同區散步 / 咖啡 / 購物，晚餐不要再換區。`
    ),
    bookingSuggestions: bookingCandidates.slice(0, 4).map((item, index) => ({
      title: item.place_name || item.title,
      reason:
        index === 0
          ? "這個最適合先鎖定，能把你整趟行程主線先固定下來。"
          : "這個適合當成後續候選預約項目。",
      href: item.href,
      buttonLabel: "查看方案",
      badge: index === 0 ? "優先預約" : "體驗",
      sourceLabel: item.sourceLabel || item.city || item.country || undefined,
      image: item.image || undefined,
      priceFrom: index === 0 ? "查看方案" : "待查看",
      duration: index === 0 ? "半日 / 一日" : "依方案為準",
      tag: index === 0 ? "AI 推薦" : "候選方案",
    })),
    content: [
      `如果我是直接幫你排 ${destination}，我不會先追求去很多地方，而是先確保每天都有節奏。`,
      `你真正需要的不是更多景點，而是更好的取捨。`,
      "",
      "我會先做三件事：",
      "1. 固定每天主區域",
      "2. 先鎖票券 / 接送 / 體驗",
      "3. 剩下再補購物、散步和咖啡店",
    ].join("\n"),
  };
}

function Pill({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        active
          ? "bg-white text-slate-900"
          : "bg-white/10 text-white/85 ring-1 ring-white/10",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-lg font-black text-slate-900">{title}</div>
      {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BulletCards({
  items,
  tone,
  numbered = false,
  emptyText,
}: {
  items: string[];
  tone: "amber" | "sky" | "emerald";
  numbered?: boolean;
  emptyText: string;
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : tone === "sky"
      ? "border-sky-200 bg-sky-50 text-sky-950"
      : "border-emerald-200 bg-emerald-50 text-emerald-950";

  if (!items.length) {
    return (
      <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item}-${index}`}
          className={`rounded-2xl border px-4 py-4 text-sm leading-7 ${toneClass}`}
        >
          {numbered ? `${index + 1}. ${item}` : item}
        </div>
      ))}
    </div>
  );
}

function getBookingTypeLabel(badge: string): BookingTab {
  const text = badge.toLowerCase();

  if (text.includes("門票")) return "tickets";
  if (text.includes("接送")) return "transfer";
  if (text.includes("包車")) return "charter";
  if (text.includes("體驗")) return "experience";
  return "all";
}

function getFallbackVisual(badge: string) {
  const text = badge.toLowerCase();

  if (text.includes("門票")) {
    return {
      emoji: "🎟️",
      bg: "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500",
    };
  }

  if (text.includes("接送")) {
    return {
      emoji: "🚐",
      bg: "bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600",
    };
  }

  if (text.includes("包車")) {
    return {
      emoji: "🚘",
      bg: "bg-gradient-to-br from-emerald-500 via-teal-500 to-green-600",
    };
  }

  return {
    emoji: "✨",
    bg: "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900",
  };
}

function ProductVisual({
  image,
  badge,
  compact = false,
}: {
  image?: string;
  badge: string;
  compact?: boolean;
}) {
  const fallback = getFallbackVisual(badge);

  if (image) {
    return (
      <div
        className={`relative overflow-hidden rounded-[20px] ${compact ? "h-28" : "h-56"} bg-slate-100`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={badge}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-3">
          <span className="inline-flex rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-900">
            {badge}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[20px] ${compact ? "h-28" : "h-56"} ${fallback.bg}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_40%)]" />
      <div className="absolute left-4 top-4 text-4xl">{fallback.emoji}</div>
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold backdrop-blur">
          {badge}
        </span>
      </div>
    </div>
  );
}

function AppProductCard({
  card,
  compact = false,
}: {
  card: BookingSuggestion;
  compact?: boolean;
}) {
  const isExternal = card.href.startsWith("http");

  const body = (
    <div className="group rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <ProductVisual image={card.image} badge={card.badge} compact={compact} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {card.tag ? (
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white">
            {card.tag}
          </span>
        ) : null}

        {card.sourceLabel ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
            {card.sourceLabel}
          </span>
        ) : null}
      </div>

      <div className={`mt-3 font-black text-slate-900 ${compact ? "text-sm leading-6" : "text-lg leading-7"}`}>
        {card.title}
      </div>

      <div className={`mt-2 text-slate-600 ${compact ? "text-xs leading-5 line-clamp-3" : "text-sm leading-6"}`}>
        {card.reason}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-400">價格</div>
          <div className={`${compact ? "text-sm" : "text-base"} font-bold text-slate-900`}>
            {card.priceFrom || "查看方案"}
          </div>
        </div>

        <div className="min-w-0 text-right">
          <div className="text-[11px] text-slate-400">時間</div>
          <div className={`${compact ? "text-xs" : "text-sm"} font-semibold text-slate-700`}>
            {card.duration || "依方案為準"}
          </div>
        </div>
      </div>

      <div className="mt-4 inline-flex rounded-full bg-[linear-gradient(135deg,#0b1324_0%,#10204a_100%)] px-4 py-2 text-xs font-semibold text-white shadow-sm">
        {card.buttonLabel}
      </div>
    </div>
  );

  return isExternal ? (
    <a href={card.href} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <Link href={card.href}>{body}</Link>
  );
}

function BookingAppPanel({
  cards,
}: {
  cards: BookingSuggestion[];
}) {
  const [activeTab, setActiveTab] = useState<BookingTab>("all");

  const filteredCards = useMemo(() => {
    if (activeTab === "all") return cards;
    return cards.filter((card) => getBookingTypeLabel(card.badge) === activeTab);
  }, [cards, activeTab]);

  const featuredCard = filteredCards[0] || cards[0] || null;
  const secondaryCards =
    filteredCards.length > 1 ? filteredCards.slice(1, 5) : cards.slice(1, 5);

  const tabs: { key: BookingTab; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "tickets", label: "門票" },
    { key: "transfer", label: "接送" },
    { key: "charter", label: "包車" },
    { key: "experience", label: "體驗" },
  ];

  return (
    <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-lg font-black text-slate-900">直接購買</div>
          <div className="mt-1 text-sm text-slate-500">
            AI 幫你挑出最值得先訂的項目，這一區會更像真正的 travel app。
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "rounded-full px-3 py-2 text-xs font-semibold transition",
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {!featuredCard ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
          目前還沒有對應的可預約候選項目，可以先補更多帶外部連結的旅遊商品內容。
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">AI 最推薦先訂</div>
                  <div className="mt-1 text-lg font-black text-slate-900">主打方案</div>
                </div>
                {featuredCard.tag ? (
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold text-white">
                    {featuredCard.tag}
                  </span>
                ) : null}
              </div>

              <AppProductCard card={featuredCard} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {secondaryCards.length === 0 ? (
                <div className="rounded-[22px] border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  目前這個分類下只有一個最推薦方案。
                </div>
              ) : (
                secondaryCards.map((card, index) => (
                  <AppProductCard key={`${card.title}-${index}`} card={card} compact />
                ))
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="text-xs text-slate-500">熱門方向</div>
              <div className="mt-2 text-sm font-bold text-slate-900">先鎖主線商品</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">
                先把最影響整趟節奏的票券、接送或包車訂下來。
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="text-xs text-slate-500">行程優先順序</div>
              <div className="mt-2 text-sm font-bold text-slate-900">先大項，再小項</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">
                先決定主景點與移動骨架，再補購物、散步、咖啡店。
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="text-xs text-slate-500">未來擴充</div>
              <div className="mt-2 text-sm font-bold text-slate-900">直接接商品頁</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">
                之後可以接 Klook、Viator、接送、包車或自家訂購頁。
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TravelPitfallCard({ post }: { post: Post }) {
  const locationText = [post.country, post.city, post.location].filter(Boolean).join(" · ");
  const actionHref = getPostPrimaryActionLink(post);
  const actionLabel = getPostActionLabel(post);
  const isExternal = Boolean(post.external_url || post.google_maps_url);

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/post/${post.id}`} className="block">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
            旅遊避坑
          </span>
          {post.country ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
              {post.country}
            </span>
          ) : null}
        </div>

        <div className="mt-3 text-lg font-black leading-7 text-slate-900">
          {post.place_name || post.title}
        </div>

        {post.place_name && post.title && post.place_name !== post.title ? (
          <div className="mt-1 text-sm text-slate-600">{post.title}</div>
        ) : null}

        {locationText ? <div className="mt-2 text-xs text-slate-500">{locationText}</div> : null}

        <div className="mt-3 line-clamp-3 text-sm leading-6 text-slate-700">{post.content}</div>
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link href={`/post/${post.id}`} className="text-sm font-semibold text-sky-700">
          看這篇避坑 →
        </Link>

        {isExternal ? (
          <a
            href={actionHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            {actionLabel}
          </a>
        ) : (
          <Link
            href={actionHref}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("3");
  const [spotsInput, setSpotsInput] = useState("");
  const [companion, setCompanion] = useState<CompanionType>("情侶");
  const [style, setStyle] = useState("輕鬆一點");
  const [budget, setBudget] = useState("");
  const [mustAvoid, setMustAvoid] = useState("");
  const [hasPlanned, setHasPlanned] = useState(false);

  const [aiResult, setAiResult] = useState<PlannerResult | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [plannerError, setPlannerError] = useState("");

  useEffect(() => {
    async function loadTravelPosts() {
      const postsRes = await supabase
        .from("posts")
        .select("*")
        .eq("category", "旅遊")
        .order("id", { ascending: false });

      const rawPosts = (postsRes.data as Post[]) || [];

      const userIds = Array.from(
        new Set(rawPosts.map((post) => post.user_id).filter(Boolean) as string[])
      );

      const profileMap: Record<string, Profile> = {};

      if (userIds.length > 0) {
        const profilesRes = await supabase
          .from("profiles")
          .select("id, email, username, display_name")
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
    }

    loadTravelPosts();
  }, []);

  const parsedSpots = useMemo(() => parseSpots(spotsInput), [spotsInput]);

  const relatedPosts = useMemo(() => {
    const dest = normalizeText(destination);
    const spotKeywords = parsedSpots.map(normalizeText);

    if (!dest && spotKeywords.length === 0) {
      return posts.slice(0, 8);
    }

    const scored = posts
      .map((post) => {
        const haystack = [
          post.title,
          post.place_name,
          post.country,
          post.city,
          post.location,
          post.content,
          ...(post.hashtags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        let score = 0;

        if (dest && haystack.includes(dest)) score += 4;
        for (const keyword of spotKeywords) {
          if (keyword && haystack.includes(keyword)) score += 2;
        }
        if (post.external_url) score += 1;
        if (post.google_maps_url) score += 1;

        return { post, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => item.post);

    return scored.length ? scored : posts.slice(0, 8);
  }, [posts, destination, parsedSpots]);

  const bookingCandidates = useMemo(() => buildBookingCandidates(relatedPosts), [relatedPosts]);

  const fallbackPlanner = useMemo(
    () =>
      buildFallbackPlannerResult({
        destination,
        days,
        spots: parsedSpots,
        companion,
        style,
        budget,
        mustAvoid,
        bookingCandidates,
      }),
    [destination, days, parsedSpots, companion, style, budget, mustAvoid, bookingCandidates]
  );

  const effectivePlanner = aiResult || fallbackPlanner;

  async function handlePlanNow() {
    if (!destination.trim()) {
      alert("請先輸入目的地");
      return;
    }

    setHasPlanned(true);
    setLoadingAI(true);
    setPlannerError("");
    setAiResult(null);

    try {
      const res = await fetch("/api/pit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destination,
          days,
          spots: parsedSpots,
          companion,
          style,
          budget,
          mustAvoid,
          bookingCandidates,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPlannerError("AI 暫時沒有成功回覆，先顯示系統預估版本。");
        setAiResult(null);
        return;
      }

      const normalized = normalizeAIResult(data);

      if (!normalized) {
        setPlannerError("AI 回覆格式不完整，先顯示系統預估版本。");
        setAiResult(null);
        return;
      }

      setAiResult(normalized);
    } catch (error) {
      console.error(error);
      setPlannerError("AI 連線失敗，先顯示系統預估版本。");
      setAiResult(null);
    } finally {
      setLoadingAI(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <SiteHeader />

        <section className="overflow-hidden rounded-[36px] bg-[radial-gradient(circle_at_top_left,_rgba(82,133,255,0.22),_transparent_32%),linear-gradient(135deg,#081226_0%,#0b1730_38%,#0f1f42_100%)] text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
          <div className="grid gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">
                AI Travel Concierge
              </div>

              <h1 className="mt-5 text-4xl font-black leading-tight sm:text-6xl">
                不只是幫你排行程，
                <br className="hidden sm:block" />
                而是幫你先避坑，再決定該買什麼。
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                BeCalm Travel 會先檢查你的旅程安排是不是太趕、太散、太容易後悔，
                再像真的旅遊顧問一樣幫你重整成更能玩的版本，最後把該先預約的東西挑出來。
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Pill>行程診斷</Pill>
                <Pill>顧問式規劃</Pill>
                <Pill>避坑提醒</Pill>
                <Pill active>未來可直接購買</Pill>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                  <div className="text-xs text-slate-300">先看風險</div>
                  <div className="mt-2 text-sm font-semibold">哪裡最容易後悔</div>
                </div>
                <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                  <div className="text-xs text-slate-300">再排版本</div>
                  <div className="mt-2 text-sm font-semibold">真的能玩的 Day by Day</div>
                </div>
                <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                  <div className="text-xs text-slate-300">最後導購</div>
                  <div className="mt-2 text-sm font-semibold">把該先訂的先鎖下來</div>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">AI 旅遊專員</div>
                  <div className="mt-1 text-xs leading-6 text-slate-500">
                    輸入需求後，AI 會先給你判斷，再幫你把行程排得更像真的能出發。
                  </div>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
                  Beta
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">你要去哪裡？</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="例如：東京 / 京都 / 大阪 / 首爾"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">去幾天？</label>
                    <input
                      type="number"
                      min={1}
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">同行類型</label>
                    <select
                      value={companion}
                      onChange={(e) => setCompanion(e.target.value as CompanionType)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                    >
                      <option>一個人</option>
                      <option>情侶</option>
                      <option>朋友</option>
                      <option>家庭親子</option>
                      <option>長輩同行</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">你想去哪些地方？</label>
                  <textarea
                    value={spotsInput}
                    onChange={(e) => setSpotsInput(e.target.value)}
                    rows={4}
                    placeholder="例如：淺草、上野、晴空塔 / 沒有安排，幫我規劃"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                  <div className="mt-2 text-xs text-slate-400">可用逗號、頓號或換行分隔。</div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">你偏好的節奏</label>
                    <input
                      type="text"
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      placeholder="例如：輕鬆一點 / 不想太累"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">預算方向</label>
                    <input
                      type="text"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="例如：中等預算 / 想省一點"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">你最不想踩的坑</label>
                  <input
                    type="text"
                    value={mustAvoid}
                    onChange={(e) => setMustAvoid(e.target.value)}
                    placeholder="例如：不想太早起 / 不想一直排隊 / 不想一直換飯店"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={handlePlanNow}
                  disabled={loadingAI}
                  className="w-full rounded-full bg-[linear-gradient(135deg,#0b1324_0%,#10204a_100%)] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
                >
                  {loadingAI ? "AI 規劃中..." : "開始讓 AI 幫我規劃"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {plannerError ? (
          <section className="mt-6">
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
              {plannerError}
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard
            title="AI 總評"
            subtitle="不是機器摘要，而是先給你一句真正有判斷的結論。"
          >
            <div className="rounded-[24px] bg-slate-50 px-4 py-5 text-sm leading-8 text-slate-700 whitespace-pre-wrap">
              {!hasPlanned
                ? "輸入你的旅遊需求後，這裡會先給你一句真正有判斷的總評。"
                : effectivePlanner.summary ||
                  "目前還沒有 AI 總評，但下方仍可先看系統產生的規劃版本。"}
            </div>
          </SectionCard>

          <SectionCard
            title="最先該注意的風險"
            subtitle="先看哪裡最容易踩雷，再談怎麼玩。"
          >
            <BulletCards
              items={hasPlanned ? effectivePlanner.warnings : []}
              tone="amber"
              emptyText="完成上方輸入後，這裡會先顯示 AI 的避坑提醒。"
            />
          </SectionCard>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard
            title="這趟應該怎麼思考"
            subtitle="先不是排細節，而是先抓對整體策略。"
          >
            <BulletCards
              items={hasPlanned ? effectivePlanner.strategy : []}
              tone="sky"
              emptyText="完成診斷後，這裡會先出現整體策略。"
            />
          </SectionCard>

          <SectionCard
            title="優化後版本"
            subtitle="幫你把旅程從願望清單，重整成更能玩的版本。"
          >
            <BulletCards
              items={hasPlanned ? effectivePlanner.optimizedPlan : []}
              tone="sky"
              numbered
              emptyText="完成診斷後，這裡會出現更具體的優化方向。"
            />
          </SectionCard>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            title="AI 每日行程建議"
            subtitle="這裡會更像真人旅遊顧問幫你排的 Day by Day。"
          >
            <BulletCards
              items={hasPlanned ? effectivePlanner.dailyPlan : []}
              tone="emerald"
              emptyText="完成診斷後，這裡會出現每日行程建議。"
            />
          </SectionCard>

          <SectionCard
            title="直接購買區"
            subtitle="這一區已升級成更像 App 的 booking panel。"
          >
            {!hasPlanned ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                完成診斷後，這裡會顯示 AI 挑出來最值得先訂的方案。
              </div>
            ) : (
              <BookingAppPanel cards={effectivePlanner.bookingSuggestions} />
            )}
          </SectionCard>
        </section>

        <section className="mt-6">
          <SectionCard
            title="AI 顧問版完整建議"
            subtitle="這一區會像 ChatGPT 一樣，直接把判斷和取捨講清楚。"
          >
            <div className="rounded-[24px] bg-slate-50 px-4 py-5 text-sm leading-8 text-slate-700 whitespace-pre-wrap">
              {!hasPlanned
                ? "等你輸入目的地、天數、偏好和限制後，這裡會出現更像真人旅遊顧問的完整建議。"
                : effectivePlanner.content || "目前還沒有完整建議內容。"}
            </div>
          </SectionCard>
        </section>

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-lg font-black text-slate-900">相關旅遊避坑內容</div>
              <div className="mt-1 text-sm text-slate-500">
                根據你的目的地與想去景點，先看看別人實際踩過哪些坑。
              </div>
            </div>

            <Link
              href="/write"
              className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              ＋ 分享旅遊避坑
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {relatedPosts.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                目前還沒有旅遊避坑內容，你可以先從第一篇開始建立資料庫。
              </div>
            ) : (
              relatedPosts.map((post) => <TravelPitfallCard key={post.id} post={post} />)
            )}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-1 pb-12 pt-10 text-sm leading-relaxed text-slate-600">
          <h2 className="mb-3 text-lg font-bold text-slate-900">關於 BeCalm Travel</h2>

          <p className="mb-3">
            BeCalm Travel 不是單純的旅遊負評站，而是把真實踩坑內容和 AI
            旅遊專員規劃結合起來的旅行決策工具。
          </p>

          <p className="mb-3">
            你可以先輸入自己的旅遊需求，看哪些景點排法太趕、哪些動線很容易後悔、哪些項目該先買，再把整趟旅行整理成更合理的版本。
          </p>

          <p>
            這一版已經把未來直接購買的路先鋪好，之後只要內容庫和商品庫更完整，這頁就可以很自然地接轉換。
          </p>
        </section>
      </div>
    </main>
  );
}