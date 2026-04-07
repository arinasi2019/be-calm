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

  const dayCount = Math.max(1, Math.min(Number(days || 3), 7));

  return {
    summary: `${destination} 可以去，但先把節奏排順比較重要。`,
    warnings: [
      spots.length > dayCount * 3
        ? "景點有點多，容易太趕。"
        : "先固定主區域會比較順。",
      companion === "家庭親子"
        ? "親子行程不要排太滿。"
        : companion === "長輩同行"
        ? "有長輩同行，移動不要太多。"
        : "熱門點不要都塞同一天。",
      style.includes("輕鬆") ? "你偏好輕鬆節奏，就不要一直跨區。" : "先抓主線，再補支線。",
    ],
    strategy: ["先定主區域", "先看必去點", "先鎖需要預約的項目"],
    optimizedPlan: ["上午主景點", "下午同區活動", "晚上不要再大跨區"],
    dailyPlan: Array.from({ length: dayCount }).map((_, i) =>
      i === 0
        ? `Day ${i + 1}：抵達後先排輕鬆一點。`
        : i === dayCount - 1
        ? `Day ${i + 1}：收尾行程，不要排太硬。`
        : `Day ${i + 1}：上午主景點，下午同區活動。`
    ),
    bookingSuggestions: bookingCandidates.slice(0, 3).map((item, index) => ({
      title: item.place_name || item.title,
      reason: index === 0 ? "可以先看這個。" : "可當候選。",
      href: item.href,
      buttonLabel: "查看",
      badge: index === 0 ? "優先" : "候選",
      sourceLabel: item.sourceLabel || undefined,
      image: item.image || undefined,
      tag: index === 0 ? "AI" : "參考",
    })),
    content: `${destination} 這趟先不要貪多，排順最重要。`,
  };
}

function MiniPostCard({ post }: { post: Post }) {
  const locationText = [post.country, post.city, post.location].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/post/${post.id}`}
      className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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

      <div className="mt-4 line-clamp-2 text-[22px] font-black leading-8 text-slate-900">
        {post.place_name || post.title}
      </div>

      {post.place_name && post.title && post.place_name !== post.title ? (
        <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{post.title}</div>
      ) : null}

      {locationText ? <div className="mt-3 text-sm text-slate-500">{locationText}</div> : null}

      <div className="mt-4 line-clamp-4 text-sm leading-7 text-slate-700">{post.content}</div>
    </Link>
  );
}

function SimpleResultCard({
  title,
  value,
}: {
  title: string;
  value?: string;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-2xl font-black text-slate-900">{title}</div>
      <div className="mt-5 rounded-[22px] bg-slate-50 px-5 py-5 text-base leading-8 text-slate-700">
        {value || "—"}
      </div>
    </div>
  );
}

function SuggestionCard({ card }: { card: BookingSuggestion }) {
  const isExternal = card.href.startsWith("http");

  const body = (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
          {card.badge}
        </span>
        {card.tag ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
            {card.tag}
          </span>
        ) : null}
      </div>

      <div className="mt-4 text-lg font-black leading-7 text-slate-900">{card.title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{card.reason}</div>

      <div className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
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

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("3");
  const [spotsInput, setSpotsInput] = useState("");
  const [companion, setCompanion] = useState<CompanionType>("情侶");
  const [style, setStyle] = useState("輕鬆一點");

  const [aiResult, setAiResult] = useState<PlannerResult | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

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
      return posts.slice(0, 6);
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

        return { post, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.post);

    return scored.length ? scored : posts.slice(0, 6);
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
        bookingCandidates,
      }),
    [destination, days, parsedSpots, companion, style, bookingCandidates]
  );

  const effectivePlanner = aiResult || fallbackPlanner;

  async function handlePlanNow() {
    if (!destination.trim()) return;

    setLoadingAI(true);
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
      const normalized = normalizeAIResult(data);

      if (normalized) {
        setAiResult(normalized);
      }
    } catch (error) {
      console.error(error);
      setAiResult(null);
    } finally {
      setLoadingAI(false);
    }
  }

  const latestPosts = posts.slice(0, 24);

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <SiteHeader />

        <section className="overflow-hidden rounded-[38px] bg-[radial-gradient(circle_at_top_left,_rgba(82,133,255,0.22),_transparent_32%),linear-gradient(135deg,#081226_0%,#0b1730_40%,#0f1f42_100%)] text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
          <div className="grid gap-8 px-6 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">
                Real Reviews + AI
              </div>

              <h1 className="mt-5 text-5xl font-black leading-[1.08] sm:text-7xl">
                先看真實經驗，
                <br className="hidden sm:block" />
                再讓 AI 幫你判斷值不值得。
              </h1>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/10">
                  真實貼文
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/10">
                  避坑重點
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/10">
                  AI 判讀
                </span>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/95 p-5 text-slate-900 shadow-2xl backdrop-blur">
              <div className="space-y-4">
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="目的地 / 主題"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="number"
                    min={1}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    placeholder="天數"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                  />

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

                <textarea
                  value={spotsInput}
                  onChange={(e) => setSpotsInput(e.target.value)}
                  rows={4}
                  placeholder="想去哪些地方"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                />

                <input
                  type="text"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  placeholder="偏好節奏"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                />

                <button
                  type="button"
                  onClick={handlePlanNow}
                  disabled={loadingAI || !destination.trim()}
                  className="w-full rounded-full bg-[linear-gradient(135deg,#0b1324_0%,#10204a_100%)] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
                >
                  {loadingAI ? "整理中..." : "開始整理"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {destination.trim() ? (
          <section className="mt-6 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div className="text-3xl font-black text-slate-900">相關貼文</div>
              <Link
                href="/write"
                className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                ＋ 分享避坑
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {relatedPosts.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  找不到相關貼文
                </div>
              ) : (
                relatedPosts.map((post) => <MiniPostCard key={post.id} post={post} />)
              )}
            </div>
          </section>
        ) : null}

        {aiResult ? (
          <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <SimpleResultCard title="AI 總評" value={effectivePlanner.summary} />
            <SimpleResultCard title="AI 建議" value={effectivePlanner.content} />

            {effectivePlanner.bookingSuggestions.length > 0 ? (
              <div className="xl:col-span-2 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 text-3xl font-black text-slate-900">建議先看</div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {effectivePlanner.bookingSuggestions.map((card, index) => (
                    <SuggestionCard key={`${card.title}-${index}`} card={card} />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-3xl font-black text-slate-900">最新貼文</div>
          </div>

          {latestPosts.length === 0 ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              目前還沒有貼文
            </div>
          ) : (
            <PostFeed posts={latestPosts} />
          )}
        </section>
      </div>
    </main>
  );
}