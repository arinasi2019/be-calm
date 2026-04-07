"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import PostFeed from "./components/PostFeed";
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
  updated_at?: string | null;
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
      const buttonLabel = String(obj.buttonLabel ?? "").trim() || "查看";
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

function buildBookingCandidates(posts: Post[]): BookingCandidate[] {
  return posts
    .filter((post) => Boolean(post.external_url || post.google_maps_url || post.booking_url))
    .map((post) => ({
      id: post.id,
      title: post.title,
      place_name: post.place_name || null,
      description: post.content || null,
      category: post.category || null,
      country: post.country || null,
      city: post.city || null,
      location: post.location || null,
      href: post.booking_url || getPostPrimaryActionLink(post),
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
  const { destination, days, spots, companion, style, mustAvoid, bookingCandidates } = params;

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

  const dayCount = Math.max(1, Math.min(Number(days || 3), 7));

  return {
    summary: `${destination} 這趟現在比較像願望清單，還不是一份真正順的行程。先把主區域、每天節奏和需要先訂的項目定下來，整體就會差很多。`,
    warnings: [
      spots.length > dayCount * 3
        ? "你列的點偏多，真正走起來很容易因為移動、排隊和用餐時間而失控。"
        : "目前沒有非常明顯的大雷，但還是建議先固定每天主區域。",
      companion === "家庭親子"
        ? "親子行程不要把熱門景點、購物和長距離移動塞同一天。"
        : companion === "長輩同行"
        ? "有長輩同行時，不要把跨區移動和晚餐排太晚。"
        : "不要把所有熱門點都堆在前兩天，後面通常會明顯疲乏。",
      mustAvoid.trim()
        ? `既然你最不想踩的坑是「${mustAvoid.trim()}」，那整趟行程就不該往太滿、太散的方向排。`
        : style.includes("輕鬆")
        ? "你偏好輕鬆節奏，就不適合一天塞太多『順便去一下』的點。"
        : "先決定每天最重要的 1 到 2 個核心點，比一直加景點更重要。",
    ].filter(Boolean),
    strategy: [
      `這趟 ${destination} 的關鍵不是去更多地方，而是每天都順。`,
      "先定每天主區域，再補咖啡、購物、散步和餐廳。",
      "先鎖熱門票券 / 接送 / 一日遊，再決定小行程。",
    ],
    optimizedPlan: [
      `先把 ${destination} 的景點分成「一定要去」和「有空再去」。`,
      `以 ${days || "這次"} 的天數來看，每天以 1 個主區域 + 1 到 2 個核心點最合理。`,
      "上午放最重要的點，下午排同區散步、購物或休息。",
      "不要晚餐後再大幅跨區，晚上收在同一區通常最舒服。",
    ],
    dailyPlan: Array.from({ length: dayCount }).map((_, i) =>
      i === 0
        ? `Day ${i + 1}：抵達後先排同區輕鬆行程，不要第一天就排最硬的景點。`
        : i === dayCount - 1
        ? `Day ${i + 1}：安排一個主要區域 + 收尾購物 / 散步，避免最後一天還來回折返。`
        : `Day ${i + 1}：上午主景點，下午同區散步 / 咖啡 / 購物，晚餐不要再換太遠的區域。`
    ),
    bookingSuggestions: bookingCandidates.slice(0, 4).map((item, index) => ({
      title: item.place_name || item.title,
      reason:
        index === 0
          ? "這個最值得先看，因為它最可能影響你整趟行程主線。"
          : "這個可以當成後續候選方案。",
      href: item.href,
      buttonLabel: "查看",
      badge: index === 0 ? "優先" : "候選",
      sourceLabel: item.sourceLabel || item.city || item.country || undefined,
      image: item.image || undefined,
      priceFrom: "查看方案",
      duration: "依方案為準",
      tag: index === 0 ? "AI 建議" : "參考",
    })),
    content: [
      `如果我是直接幫你排 ${destination}，我不會先追求去更多地方，而是先確保每天都有節奏。`,
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

function ProductCard({ card }: { card: BookingSuggestion }) {
  const isExternal = card.href.startsWith("http");

  const body = (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white">
          {card.badge}
        </span>
        {card.tag ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
            {card.tag}
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-base font-black leading-7 text-slate-900">{card.title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{card.reason}</div>

      <div className="mt-4 inline-flex rounded-full bg-[linear-gradient(135deg,#0b1324_0%,#10204a_100%)] px-4 py-2 text-xs font-semibold text-white">
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

function RelatedMiniCard({ post }: { post: Post }) {
  const locationText = [post.country, post.city, post.location].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/post/${post.id}`}
      className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
          {post.category}
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
    async function loadPosts() {
      const postsRes = await supabase
        .from("posts")
        .select("*")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false });

      const rawPosts = (postsRes.data as Post[]) || [];

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
    }

    loadPosts();
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
        if (post.booking_url) score += 1;

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

  const latestPosts = posts.slice(0, 24);
  const featuredPosts = posts.filter((post) => post.is_featured).slice(0, 6);

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <SiteHeader />

        <section className="overflow-hidden rounded-[36px] bg-[radial-gradient(circle_at_top_left,_rgba(82,133,255,0.22),_transparent_32%),linear-gradient(135deg,#081226_0%,#0b1730_38%,#0f1f42_100%)] text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
          <div className="grid gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">
                Real Reviews + AI Judgement
              </div>

              <h1 className="mt-5 text-4xl font-black leading-tight sm:text-6xl">
                先看真實經驗，
                <br className="hidden sm:block" />
                再讓 AI 幫你判斷值不值得。
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                BeCalm 不只是避坑內容站，也不是只有 AI 工具。
                你可以先看別人的真實分享，再讓 AI 幫你整理風險、取捨和更順的版本。
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Pill>真實貼文</Pill>
                <Pill>避坑重點</Pill>
                <Pill>AI 判讀</Pill>
                <Pill active>值不值得</Pill>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                  <div className="text-xs text-slate-300">先看內容</div>
                  <div className="mt-2 text-sm font-semibold">真實經驗與避坑貼文</div>
                </div>
                <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                  <div className="text-xs text-slate-300">再看 AI</div>
                  <div className="mt-2 text-sm font-semibold">整理重點與判斷</div>
                </div>
                <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                  <div className="text-xs text-slate-300">最後決定</div>
                  <div className="mt-2 text-sm font-semibold">值不值得去、買或訂</div>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">AI 判讀助手</div>
                  <div className="mt-1 text-xs leading-6 text-slate-500">
                    可用在旅遊規劃，也可以先當成「值不值得」的 AI 整理入口。
                  </div>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
                  Beta
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">目的地 / 主題</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="例如：東京 / 京都 / 首爾 / 大阪親子"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">天數</label>
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
                    <label className="mb-2 block text-sm font-medium">偏好節奏</label>
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
                  <label className="mb-2 block text-sm font-medium">最不想踩的坑</label>
                  <input
                    type="text"
                    value={mustAvoid}
                    onChange={(e) => setMustAvoid(e.target.value)}
                    placeholder="例如：不想一直排隊 / 不想一直換飯店 / 不想太早起"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={handlePlanNow}
                  disabled={loadingAI}
                  className="w-full rounded-full bg-[linear-gradient(135deg,#0b1324_0%,#10204a_100%)] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
                >
                  {loadingAI ? "AI 判讀中..." : "開始讓 AI 幫我整理"}
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
          <SectionCard title="AI 總評" subtitle="先給你一句真正有判斷的結論。">
            <div className="rounded-[24px] bg-slate-50 px-4 py-5 text-sm leading-8 text-slate-700 whitespace-pre-wrap">
              {!hasPlanned
                ? "輸入需求後，這裡會先給你一句真正有判斷的總評。"
                : effectivePlanner.summary || "目前還沒有 AI 總評。"}
            </div>
          </SectionCard>

          <SectionCard title="最先該注意的風險" subtitle="先看哪裡最容易踩雷。">
            <BulletCards
              items={hasPlanned ? effectivePlanner.warnings : []}
              tone="amber"
              emptyText="完成上方輸入後，這裡會顯示 AI 的避坑提醒。"
            />
          </SectionCard>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard title="這趟應該怎麼思考" subtitle="先抓整體策略，不是先堆細節。">
            <BulletCards
              items={hasPlanned ? effectivePlanner.strategy : []}
              tone="sky"
              emptyText="完成判讀後，這裡會出現整體策略。"
            />
          </SectionCard>

          <SectionCard title="優化後版本" subtitle="把願望清單，重整成比較能玩的版本。">
            <BulletCards
              items={hasPlanned ? effectivePlanner.optimizedPlan : []}
              tone="sky"
              numbered
              emptyText="完成判讀後，這裡會出現更具體的優化方向。"
            />
          </SectionCard>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard title="AI 每日建議" subtitle="更像真人顧問幫你排的 Day by Day。">
            <BulletCards
              items={hasPlanned ? effectivePlanner.dailyPlan : []}
              tone="emerald"
              emptyText="完成判讀後，這裡會出現每日建議。"
            />
          </SectionCard>

          <SectionCard title="AI 建議先看的方案" subtitle="不是硬推銷，是先把主線候選挑出來。">
            {!hasPlanned ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                完成判讀後，這裡會顯示 AI 挑出來值得先看的方案。
              </div>
            ) : effectivePlanner.bookingSuggestions.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                目前還沒有對應候選方案，但你可以先看下方相關貼文。
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {effectivePlanner.bookingSuggestions.map((card, index) => (
                  <ProductCard key={`${card.title}-${index}`} card={card} />
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        <section className="mt-6">
          <SectionCard
            title="AI 顧問版完整建議"
            subtitle="這區會像 ChatGPT 一樣，把判斷和取捨講清楚。"
          >
            <div className="rounded-[24px] bg-slate-50 px-4 py-5 text-sm leading-8 text-slate-700 whitespace-pre-wrap">
              {!hasPlanned
                ? "等你輸入目的地、天數、偏好和限制後，這裡會出現更像真人顧問的完整建議。"
                : effectivePlanner.content || "目前還沒有完整建議內容。"}
            </div>
          </SectionCard>
        </section>

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-lg font-black text-slate-900">與你輸入內容相關的貼文</div>
              <div className="mt-1 text-sm text-slate-500">
                不只旅遊，所有真實經驗都可以當成 AI 判讀的資料來源。
              </div>
            </div>

            <Link
              href="/write"
              className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              ＋ 分享避坑
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {relatedPosts.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                目前還沒有足夠相關內容，你可以先從第一篇開始建立資料庫。
              </div>
            ) : (
              relatedPosts.map((post) => <RelatedMiniCard key={post.id} post={post} />)
            )}
          </div>
        </section>

        {featuredPosts.length > 0 ? (
          <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-black text-slate-900">精選內容</div>
            <div className="mt-1 text-sm text-slate-500">先看目前值得優先閱讀的貼文。</div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredPosts.map((post) => (
                <RelatedMiniCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xl font-black text-slate-900">最新貼文</div>
              <div className="mt-1 text-sm text-slate-500">
                這裡才是 BeCalm 的主體：真實內容、留言、收藏、按坑與搜尋。
              </div>
            </div>
          </div>

          {latestPosts.length === 0 ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              目前還沒有貼文，來發第一篇吧。
            </div>
          ) : (
            <PostFeed posts={latestPosts} />
          )}
        </section>
      </div>
    </main>
  );
}