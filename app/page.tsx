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

type PlannerResult = {
  warnings: string[];
  optimizedPlan: string[];
  bookingSuggestions: string[];
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

function buildPlannerResult(params: {
  destination: string;
  days: string;
  spots: string[];
  companion: CompanionType;
  style: string;
}) {
  const warnings: string[] = [];
  const optimizedPlan: string[] = [];
  const bookingSuggestions: string[] = [];

  const dayCount = Number(params.days || 0);
  const spotCount = params.spots.length;
  const destination = params.destination.trim();

  if (!destination) {
    return {
      warnings: [],
      optimizedPlan: [],
      bookingSuggestions: [],
    };
  }

  if (dayCount > 0 && spotCount > dayCount * 3) {
    warnings.push("你排的點偏多，整體節奏可能會太趕，轉場時間容易被低估。");
  }

  if (params.spots.some((spot) => /羅浮宮|louvre/i.test(spot)) && dayCount <= 1) {
    warnings.push("如果有羅浮宮，通常不要只抓很短時間，很多人實際去後都覺得半天不夠。");
  }

  if (params.spots.some((spot) => /迪士尼|disney/i.test(spot)) && params.companion === "家庭親子") {
    warnings.push("親子行程不要把熱門大景點和太多移動排在同一天，小孩體力和排隊時間常常會失控。");
  }

  if (params.companion === "長輩同行") {
    warnings.push("有長輩同行時，行程建議保留更多休息與交通緩衝，不要把一天排太滿。");
  }

  if (params.style.includes("輕鬆")) {
    warnings.push("你偏好輕鬆行程，建議每天主景點 1–2 個就好，不要塞太多『順便』景點。");
  }

  if (warnings.length === 0) {
    warnings.push("目前看起來沒有明顯爆雷點，但還是建議確認熱門景點的停留時間與預約需求。");
  }

  optimizedPlan.push(`先把 ${destination} 的核心景點分成「必去」和「可刪」兩層，避免全部硬塞在同一天。`);

  if (dayCount > 0) {
    optimizedPlan.push(`以 ${dayCount} 天來看，建議每天只安排 1–2 個主要景點，再搭配附近散步或用餐。`);
  } else {
    optimizedPlan.push("建議先確認你實際停留天數，這會直接影響動線是否合理。");
  }

  if (params.spots.length > 0) {
    optimizedPlan.push(`優先把同區域的點排在一起，例如：${params.spots.slice(0, 2).join(" / ")} 不要反覆跨區來回。`);
  }

  if (params.companion === "家庭親子") {
    optimizedPlan.push("親子行程建議加上午休、提早晚餐或保留回飯店休息時間。");
  }

  if (params.companion === "長輩同行") {
    optimizedPlan.push("長輩同行建議減少換車次數，必要時優先考慮包車或接送。");
  }

  bookingSuggestions.push("熱門景點門票");
  bookingSuggestions.push("機場接送 / 市區接送");
  bookingSuggestions.push("一日遊 / 導覽行程");

  if (params.companion === "家庭親子") {
    bookingSuggestions.push("親子友善體驗或快速入場產品");
  }

  return {
    warnings,
    optimizedPlan,
    bookingSuggestions,
  };
}

function TravelPitfallCard({ post }: { post: Post }) {
  const locationText = [post.country, post.city, post.location].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/post/${post.id}`}
      className="block rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
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

      {locationText && (
        <div className="mt-2 text-xs text-slate-500">{locationText}</div>
      )}

      <div className="mt-3 line-clamp-3 text-sm leading-6 text-slate-700">
        {post.content}
      </div>

      <div className="mt-4 text-sm font-semibold text-sky-700">
        看這篇避坑 →
      </div>
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
  const [hasPlanned, setHasPlanned] = useState(false);

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

  const plannerResult = useMemo(
    () =>
      buildPlannerResult({
        destination,
        days,
        spots: parsedSpots,
        companion,
        style,
      }),
    [destination, days, parsedSpots, companion, style]
  );

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

        if (dest && haystack.includes(dest)) score += 3;

        for (const keyword of spotKeywords) {
          if (keyword && haystack.includes(keyword)) score += 2;
        }

        return { post, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.post);

    return scored.length > 0 ? scored : posts.slice(0, 6);
  }, [posts, destination, parsedSpots]);

  function handlePlanNow() {
    if (!destination.trim()) {
      alert("請先輸入你要去的目的地");
      return;
    }
    setHasPlanned(true);
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] pb-16 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-5 sm:py-6">
        <SiteHeader />

        <section className="overflow-hidden rounded-[34px] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#1e293b] text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
          <div className="grid gap-6 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">
                AI 旅遊避坑 × 行程優化
              </div>

              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
                把你的旅行計畫丟進來，
                <br className="hidden sm:block" />
                先避坑，再出發。
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                不只是看負評，而是先檢查你的旅程安排有沒有太趕、太雷、太容易後悔。
                看別人踩過哪些坑，再讓 AI 幫你把行程調整得更合理。
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  行程避坑
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  動線優化
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  景點安排建議
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  預約導流
                </span>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur">
              <div className="text-sm font-bold text-slate-900">AI 行程診斷</div>
              <div className="mt-1 text-xs leading-6 text-slate-500">
                先輸入你的旅行安排，這個初版會先用規則邏輯幫你做避坑診斷與行程優化預覽。
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">你要去哪裡？</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="例如：巴黎 / 東京 / 京都 / 首爾"
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
                    placeholder="例如：羅浮宮、奧賽美術館、塞納河遊船、巴黎鐵塔"
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
                  className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
                >
                  開始診斷我的行程
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-black text-slate-900">AI 避坑提醒</div>
            <div className="mt-1 text-sm text-slate-500">
              先看你的安排哪裡最容易出問題。
            </div>

            {!hasPlanned ? (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                先輸入你的目的地與想去的點，這裡會顯示 AI 的避坑提醒。
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {plannerResult.warnings.map((warning, index) => (
                  <div
                    key={`${warning}-${index}`}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900"
                  >
                    ⚠ {warning}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-black text-slate-900">優化後行程方向</div>
            <div className="mt-1 text-sm text-slate-500">
              先把容易後悔的地方改掉，再決定怎麼訂。
            </div>

            {!hasPlanned ? (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                完成上方輸入後，這裡會先產出一版優化方向。
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {plannerResult.optimizedPlan.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-900"
                  >
                    {index + 1}. {item}
                  </div>
                ))}
              </div>
            )}
          </div>
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

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-black text-slate-900">一鍵預約方向</div>
          <div className="mt-1 text-sm text-slate-500">
            看完避坑與優化後，下一步就是把該訂的東西直接訂起來。
          </div>

          {!hasPlanned ? (
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
              完成行程診斷後，這裡會顯示更適合你的預約方向。
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {plannerResult.bookingSuggestions.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4"
                >
                  <div className="text-sm font-bold text-emerald-900">{item}</div>
                  <div className="mt-2 text-xs leading-5 text-emerald-800">
                    之後可接門票、接送、tour、包車或其他預約產品。
                  </div>
                  <button
                    type="button"
                    className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                  >
                    之後接預約
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mx-auto max-w-5xl px-1 pb-8 pt-10 text-sm leading-relaxed text-slate-600">
          <h2 className="mb-3 text-lg font-bold text-slate-900">關於 BeCalm Travel</h2>

          <p className="mb-3">
            BeCalm Travel 不是單純的旅遊負評站，而是把「真實踩坑內容」和
            「AI 行程優化」結合起來的旅行決策工具。
          </p>

          <p className="mb-3">
            你可以先輸入自己的行程安排，看哪些景點排法太趕、哪些地方實際上不值得、
            哪些動線很容易後悔，再根據別人的真實經驗調整成更合理的版本。
          </p>

          <p>
            下一步，我們可以把這個初版再接上真正的 AI 回覆、個人化行程生成、
            以及門票 / 接送 / 體驗的一鍵預約能力。
          </p>
        </section>
      </div>
    </main>
  );
}