"use client";

import { useMemo, useState, useEffect } from "react";
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
};

type PlannerResult = {
  warnings: string[];
  optimizedPlan: string[];
  bookingSuggestions: BookingSuggestion[];
  dailyPlan: string[];
  summary?: string;
  content?: string;
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
  return input
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
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

      if (!title || !reason || !href) return null;

      return {
        title,
        reason,
        href,
        buttonLabel,
        badge,
        sourceLabel,
      };
    })
    .filter(Boolean) as BookingSuggestion[];
}

function normalizeAIResult(input: unknown): PlannerResult | null {
  if (!input || typeof input !== "object") return null;

  const obj = input as Record<string, unknown>;

  const warnings = safeArray(obj.warnings);
  const optimizedPlan = safeArray(obj.optimizedPlan);
  const dailyPlan = safeArray(obj.dailyPlan);
  const bookingSuggestions = normalizeBookingSuggestions(obj.bookingSuggestions);
  const summary =
    typeof obj.summary === "string" && obj.summary.trim()
      ? obj.summary.trim()
      : undefined;
  const content =
    typeof obj.content === "string" && obj.content.trim()
      ? obj.content.trim()
      : undefined;

  if (
    warnings.length === 0 &&
    optimizedPlan.length === 0 &&
    bookingSuggestions.length === 0 &&
    dailyPlan.length === 0 &&
    !summary &&
    !content
  ) {
    return null;
  }

  return {
    warnings,
    optimizedPlan,
    bookingSuggestions,
    dailyPlan,
    summary,
    content,
  };
}

function buildPlannerFallbackResult(params: {
  destination: string;
  days: string;
  spots: string[];
  companion: CompanionType;
  style: string;
  bookingCandidates: BookingCandidate[];
}): PlannerResult {
  const warnings: string[] = [];
  const optimizedPlan: string[] = [];
  const dailyPlan: string[] = [];
  const bookingSuggestions: BookingSuggestion[] = [];

  const dayCount = Number(params.days || 0);
  const destination = params.destination.trim();

  if (!destination) {
    return {
      warnings: [],
      optimizedPlan: [],
      bookingSuggestions: [],
      dailyPlan: [],
      summary: "",
      content: "",
    };
  }

  if (params.spots.length > 0 && dayCount > 0 && params.spots.length > dayCount * 3) {
    warnings.push("你現在列的點偏多，實際走起來很容易太趕。");
  }

  if (params.companion === "家庭親子") {
    warnings.push("親子行程不要把熱門景點、購物與長距離移動塞同一天。");
  }

  if (params.companion === "長輩同行") {
    warnings.push("長輩同行時，真正累的通常不是景點，而是轉車和反覆移動。");
  }

  if (params.style.includes("輕鬆")) {
    warnings.push("你偏好輕鬆型節奏，就不適合一天塞太多『順便去一下』的點。");
  }

  if (warnings.length === 0) {
    warnings.push("目前沒有明顯大雷，但建議先確認每天主區域與轉場節奏。");
  }

  optimizedPlan.push(`先把 ${destination} 的景點分成「一定要去」和「有空再去」。`);
  optimizedPlan.push(`以 ${params.days || "這次"} 的天數看，每天以 1 個主區域最舒服。`);
  optimizedPlan.push("早上排最重要的點，下午留給附近散步、咖啡、購物或休息。");

  const safeDayCount = Math.max(1, Math.min(dayCount || 3, 6));
  for (let i = 1; i <= safeDayCount; i++) {
    dailyPlan.push(`Day ${i}：先排一個主區域與一個重點景點，避免跨區折返。`);
  }

  bookingSuggestions.push(
    ...params.bookingCandidates.slice(0, 4).map((item, index) => ({
      title: item.place_name || item.title,
      reason:
        index === 0
          ? "這個最適合先鎖定，能先把主線行程定下來。"
          : "這個可作為你這趟行程的候選預約項目。",
      href: item.href,
      buttonLabel: "查看方案",
      badge: index === 0 ? "優先預約" : "候選方案",
      sourceLabel: item.sourceLabel || item.city || item.country || undefined,
    }))
  );

  return {
    warnings,
    optimizedPlan,
    bookingSuggestions,
    dailyPlan,
    summary: `${destination} 這趟目前比較像願望清單，還不是最舒服的執行版本。先把每天主區域和該先訂的項目定下來，整體體驗會更好。`,
    content: [
      `這趟 ${destination}，我不建議一開始就追求去很多地方。`,
      `真正好玩的自由行，是每天都有重點，但又不會一直在趕路。`,
      "",
      "你應該先做的事：",
      "1. 先定每天主區域",
      "2. 先鎖最值得預約的門票 / 接送 / 體驗",
      "3. 剩下再補散步、購物和咖啡店",
    ].join("\n"),
  };
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
    }));
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
          {post.country && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
              {post.country}
            </span>
          )}
        </div>

        <div className="mt-3 text-lg font-black leading-7 text-slate-900">
          {post.place_name || post.title}
        </div>

        {post.place_name && post.title && post.place_name !== post.title && (
          <div className="mt-1 text-sm text-slate-600">{post.title}</div>
        )}

        {locationText && <div className="mt-2 text-xs text-slate-500">{locationText}</div>}

        <div className="mt-3 line-clamp-3 text-sm leading-6 text-slate-700">
          {post.content}
        </div>
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

function SummaryCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-lg font-black text-slate-900">{title}</div>
      <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
        {body}
      </div>
    </div>
  );
}

function ResultListCard({
  title,
  subtitle,
  items,
  tone = "amber",
  numbered = false,
  emptyText,
}: {
  title: string;
  subtitle: string;
  items: string[];
  tone?: "amber" | "sky" | "rose" | "emerald";
  numbered?: boolean;
  emptyText: string;
}) {
  const toneClass =
    tone === "sky"
      ? "border-sky-200 bg-sky-50 text-sky-900"
      : tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-lg font-black text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{subtitle}</div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className={`rounded-2xl border px-4 py-4 text-sm leading-7 ${toneClass}`}
            >
              {numbered ? `${index + 1}. ${item}` : item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingCardView({ card }: { card: BookingSuggestion }) {
  const isExternal = card.href.startsWith("http");

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-semibold text-white">
          {card.badge}
        </span>
        {card.sourceLabel && (
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
            {card.sourceLabel}
          </span>
        )}
      </div>

      <div className="mt-3 text-sm font-bold text-emerald-900">{card.title}</div>
      <div className="mt-2 text-xs leading-6 text-emerald-800 whitespace-pre-wrap">
        {card.reason}
      </div>

      {isExternal ? (
        <a
          href={card.href}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          {card.buttonLabel}
        </a>
      ) : (
        <Link
          href={card.href}
          className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          {card.buttonLabel}
        </Link>
      )}
    </div>
  );
}

function LongformAdviceCard({ content }: { content: string }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-lg font-black text-slate-900">AI 顧問版完整建議</div>
      <div className="mt-1 text-sm text-slate-500">
        這裡會像真人旅遊顧問一樣，把節奏、取捨、預約順序講清楚。
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm leading-8 text-slate-700 whitespace-pre-wrap">
        {content}
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

    return scored.length > 0 ? scored : posts.slice(0, 8);
  }, [posts, destination, parsedSpots]);

  const bookingCandidates = useMemo(() => {
    return buildBookingCandidates(relatedPosts);
  }, [relatedPosts]);

  const fallbackPlannerResult = useMemo(
    () =>
      buildPlannerFallbackResult({
        destination,
        days,
        spots: parsedSpots,
        companion,
        style,
        bookingCandidates,
      }),
    [destination, days, parsedSpots, companion, style, bookingCandidates]
  );

  const effectivePlanner = aiResult || fallbackPlannerResult;

  async function handlePlanNow() {
    if (!destination.trim()) {
      alert("請先輸入你要去的目的地");
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
          bookingCandidates,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("API /api/pit failed:", data);
        setPlannerError("AI 暫時沒有成功回覆，先顯示系統預估版本。");
        setAiResult(null);
        return;
      }

      const normalized = normalizeAIResult(data);

      if (!normalized) {
        console.error("normalizeAIResult failed:", data);
        setPlannerError("AI 回覆格式不完整，先顯示系統預估版本。");
        setAiResult(null);
        return;
      }

      setAiResult(normalized);
    } catch (error) {
      console.error("AI fetch error:", error);
      setPlannerError("AI 連線失敗，先顯示系統預估版本。");
      setAiResult(null);
    } finally {
      setLoadingAI(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] pb-16 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-5 sm:py-6">
        <SiteHeader />

        <section className="overflow-hidden rounded-[34px] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#1e293b] text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
          <div className="grid gap-6 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">
                AI 旅遊避坑 × 行程優化 × 導購
              </div>

              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
                把你的旅行計畫丟進來，
                <br className="hidden sm:block" />
                先避坑，再出發。
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                不只是看負評，而是先檢查你的旅程安排有沒有太趕、太雷、太容易後悔。
                AI 會像真人旅遊顧問一樣幫你重排，並直接挑出適合先預約的方案。
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  行程避坑
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  動線優化
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  每日規劃
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  直接導購
                </span>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur">
              <div className="text-sm font-bold text-slate-900">AI 行程診斷</div>
              <div className="mt-1 text-xs leading-6 text-slate-500">
                輸入你的旅行安排後，AI 會幫你抓節奏、動線、停留時間與預約優先順序。
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">你要去哪裡？</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="例如：東京 / 京都 / 大阪 / 首爾"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
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
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">同行類型</label>
                    <select
                      value={companion}
                      onChange={(e) => setCompanion(e.target.value as CompanionType)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
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
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                  />
                  <div className="mt-2 text-xs text-slate-400">
                    可用逗號、頓號或換行分隔。
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">你偏好的節奏</label>
                  <input
                    type="text"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    placeholder="例如：輕鬆一點 / 想多看幾個景點 / 不想太累"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handlePlanNow}
                  disabled={loadingAI}
                  className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  {loadingAI ? "AI 規劃中..." : "開始診斷我的行程"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {plannerError && (
          <section className="mt-6">
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
              {plannerError}
            </div>
          </section>
        )}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <SummaryCard
            title="AI 行程總結"
            body={
              !hasPlanned
                ? "先輸入目的地、天數、同行類型與想去的地方，這裡會先給你整體判斷。"
                : effectivePlanner.summary ||
                  `${destination || "這趟旅程"} 已完成初步診斷，建議先看避坑提醒，再往下看優化版與可直接預約的方案。`
            }
          />

          <ResultListCard
            title="AI 避坑提醒"
            subtitle="先看你的安排哪裡最容易出問題。"
            items={hasPlanned ? effectivePlanner.warnings : []}
            tone="amber"
            emptyText="完成上方輸入後，這裡會顯示 AI 的避坑提醒。"
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <ResultListCard
            title="優化後行程方向"
            subtitle="不是叫你全部照原本的去，而是幫你重排成更順的版本。"
            items={hasPlanned ? effectivePlanner.optimizedPlan : []}
            tone="sky"
            numbered
            emptyText="完成上方輸入後，這裡會產出更像真人顧問的優化方向。"
          />

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-black text-slate-900">建議你先訂的方案</div>
            <div className="mt-1 text-sm text-slate-500">
              這裡不是固定模板，而是 AI 根據你的行程與候選商品挑出來的。
            </div>

            {!hasPlanned ? (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                完成行程診斷後，這裡會顯示更具體的預約建議。
              </div>
            ) : effectivePlanner.bookingSuggestions.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                目前還沒有對應的可預約候選項目，可以先補更多目的地相關內容或商品。
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {effectivePlanner.bookingSuggestions.map((card, index) => (
                  <BookingCardView key={`${card.title}-${index}`} card={card} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6">
          <ResultListCard
            title="AI 每日行程建議"
            subtitle="這裡會更像 ChatGPT 幫你真的排出可執行的 Day by Day。"
            items={hasPlanned ? effectivePlanner.dailyPlan : []}
            tone="emerald"
            emptyText="完成診斷後，這裡會出現每日行程版本。"
          />
        </section>

        <section className="mt-6">
          <LongformAdviceCard
            content={
              !hasPlanned
                ? "等你輸入目的地、天數與偏好後，這裡會出現更像真人旅遊顧問的完整建議。"
                : effectivePlanner.content || "目前還沒有更完整的顧問版建議內容。"
            }
          />
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

        <section className="mx-auto max-w-5xl px-1 pb-8 pt-10 text-sm leading-relaxed text-slate-600">
          <h2 className="mb-3 text-lg font-bold text-slate-900">關於 BeCalm Travel</h2>

          <p className="mb-3">
            BeCalm Travel 不是單純的旅遊負評站，而是把真實踩坑內容和 AI 行程優化結合起來的旅行決策工具。
          </p>

          <p className="mb-3">
            你可以先輸入自己的安排，看哪些景點排法太趕、哪些動線很容易後悔、哪些東西應該先訂，再根據真實內容調整成更合理的版本。
          </p>

          <p>
            這一版的重點，是讓 AI 不只會說建議，還能直接挑出可以導購、可以預約的方案。
          </p>
        </section>
      </div>
    </main>
  );
}