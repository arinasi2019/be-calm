"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type RiskLevel = "低" | "中" | "高";

type MediaItem = {
  type: "image" | "video";
  url: string;
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

  is_seed?: boolean;
  seed_author_name?: string | null;
  is_featured?: boolean | null;
  published_at?: string | null;

  can_try?: boolean | null;
  booking_url?: string | null;
  price_from?: number | null;
  try_button_label?: string | null;
  pitfall_summary?: string[] | null;
};

type PlanOption = {
  id: string;
  name: string;
  desc: string;
  price: number;
  tag?: string;
};

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

function formatDateTime(dateString: string | null) {
  if (!dateString) return "未知時間";

  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "未知時間";

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatPrice(price?: number | null, country?: string | null) {
  if (price == null || Number.isNaN(price)) return null;

  if (country === "日本") return `¥${price.toLocaleString("ja-JP")}`;
  if (country === "台灣") return `NT$${price.toLocaleString("zh-TW")}`;
  if (country === "澳洲") return `A$${price.toLocaleString("en-AU")}`;

  return `$${price.toLocaleString()}`;
}

function getMediaList(post: Post): MediaItem[] {
  if (post.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
    return [...post.media_urls];
  }

  const fallback: MediaItem[] = [];
  if (post.image_url) fallback.push({ type: "image", url: post.image_url });
  if (post.video_url) fallback.push({ type: "video", url: post.video_url });
  return fallback;
}

function getRiskBadgeClass(riskLevel?: RiskLevel | null) {
  if (riskLevel === "高") return "border-rose-200 bg-rose-50 text-rose-700";
  if (riskLevel === "中") return "border-amber-200 bg-amber-50 text-amber-700";
  if (riskLevel === "低") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getPitfallSummary(post: Post) {
  if (Array.isArray(post.pitfall_summary) && post.pitfall_summary.length > 0) {
    return post.pitfall_summary.filter(Boolean).slice(0, 5);
  }

  const items: string[] = [];

  if (post.risk_level === "高") items.push("風險偏高，建議先完整閱讀原貼文");
  if (post.risk_level === "中") items.push("評價兩極，實際感受可能因人而異");
  if (post.category === "餐廳") items.push("建議先確認排隊時間與實際期待是否相符");
  if (post.category === "旅遊") items.push("預訂前建議確認行程內容與現場狀況");
  if (post.category === "商品") items.push("購買前建議比價並確認是否真符合需求");
  if (post.google_maps_url) items.push("可先查看 Google 店家資訊與近期照片");

  return items.slice(0, 5);
}

function buildPlans(post: Post): PlanOption[] {
  const base = post.price_from ?? 1200;

  if (post.category === "餐廳") {
    return [
      {
        id: "light",
        name: "踩坑輕量版",
        desc: "先去看看現場、拍照、簡單體驗",
        price: base,
        tag: "入門",
      },
      {
        id: "standard",
        name: "踩坑標準版",
        desc: "一般消費者最常選擇的基本體驗",
        price: Math.round(base * 1.6),
        tag: "最多人選",
      },
      {
        id: "full",
        name: "踩坑完整版",
        desc: "想完整體驗一次，不留遺憾",
        price: Math.round(base * 2.3),
        tag: "完整",
      },
    ];
  }

  if (post.category === "旅遊") {
    return [
      {
        id: "basic",
        name: "先去看看",
        desc: "適合想低成本實測的人",
        price: base,
        tag: "輕量",
      },
      {
        id: "popular",
        name: "熱門體驗",
        desc: "最常見的標準方案",
        price: Math.round(base * 1.8),
        tag: "推薦",
      },
      {
        id: "plus",
        name: "完整踩坑",
        desc: "想把重點都體驗到",
        price: Math.round(base * 2.6),
        tag: "進階",
      },
    ];
  }

  if (post.category === "商品") {
    return [
      {
        id: "single",
        name: "單件試試",
        desc: "先買一個看看是否真的值得",
        price: base,
        tag: "保守派",
      },
      {
        id: "popular",
        name: "熱門規格",
        desc: "一般最常被購買的版本",
        price: Math.round(base * 1.4),
        tag: "主流",
      },
      {
        id: "bundle",
        name: "多買一點",
        desc: "適合真的很想親自踩坑的人",
        price: Math.round(base * 2.2),
        tag: "加碼",
      },
    ];
  }

  return [
    {
      id: "basic",
      name: "先試試",
      desc: "先低成本感受一次",
      price: base,
      tag: "入門",
    },
    {
      id: "standard",
      name: "標準踩坑",
      desc: "最穩妥的基本方案",
      price: Math.round(base * 1.7),
      tag: "標準",
    },
    {
      id: "full",
      name: "完整踩坑",
      desc: "適合很想自己判斷的人",
      price: Math.round(base * 2.4),
      tag: "完整",
    },
  ];
}

export default function TryPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [visitDate, setVisitDate] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    async function loadPost() {
      if (!id || Number.isNaN(id)) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("載入踩坑頁資料失敗：", error.message);
        setPost(null);
        setLoading(false);
        return;
      }

      setPost(data as Post);
      setLoading(false);
    }

    loadPost();
  }, [id]);

  const mediaList = useMemo(() => (post ? getMediaList(post) : []), [post]);
  const coverMedia = mediaList[0];
  const pitfallItems = useMemo(() => (post ? getPitfallSummary(post) : []), [post]);
  const plans = useMemo(() => (post ? buildPlans(post) : []), [post]);

  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(plans[1]?.id || plans[0].id);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0];
  const subtotal = selectedPlan ? selectedPlan.price * quantity : 0;
  const serviceFee = selectedPlan ? Math.round(subtotal * 0.08) : 0;
  const total = subtotal + serviceFee;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8f8f6] px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[32px] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            載入中...
          </div>
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-[#f8f8f6] px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="text-lg font-bold text-slate-900">找不到這篇踩坑頁</div>
            <div className="mt-2 text-sm text-slate-500">這篇內容可能不存在，或尚未開放親自踩坑。</div>

            <button
              onClick={() => router.push("/")}
              className="mt-6 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              回首頁
            </button>
          </div>
        </div>
      </main>
    );
  }

  const purchaseHref = post.booking_url || post.external_url || post.google_maps_url || "#";

  return (
    <main className="min-h-screen bg-[#f8f8f6] px-4 py-6 pb-20 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center gap-3 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-900">
            首頁
          </Link>
          <span>/</span>
          <Link href={`/#post-${post.id}`} className="hover:text-slate-900">
            原貼文
          </Link>
          <span>/</span>
          <span className="text-slate-900">親自踩坑</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
              <div className="relative">
                {coverMedia?.type === "image" ? (
                  <img
                    src={coverMedia.url}
                    alt={post.title}
                    className="h-[320px] w-full object-cover sm:h-[420px]"
                  />
                ) : coverMedia?.type === "video" ? (
                  <video
                    src={coverMedia.url}
                    controls
                    playsInline
                    className="h-[320px] w-full bg-black object-cover sm:h-[420px]"
                  />
                ) : (
                  <div className="flex h-[320px] w-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-orange-50 sm:h-[420px]">
                    <div className="text-center">
                      <div className="text-5xl">🕳️</div>
                      <div className="mt-3 text-sm text-slate-500">親自踩坑頁面</div>
                    </div>
                  </div>
                )}

                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    親自踩坑
                  </span>

                  {post.risk_level && (
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRiskBadgeClass(
                        post.risk_level
                      )}`}
                    >
                      風險：{post.risk_level}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                    {post.category}
                  </span>

                  {formatLocation(post) && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                      {getCountryFlag(post.country)} {formatLocation(post)}
                    </span>
                  )}

                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                    建立日期：{formatDateTime(post.published_at || post.created_at)}
                  </span>
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                  {post.place_name || post.title}
                </h1>

                <div className="mt-3 text-sm leading-7 text-slate-600">
                  看完避坑內容之後，還是想自己判斷一次？這裡是你專屬的「親自踩坑」頁面。
                  我們先把可能的雷點攤開，再讓你自己決定值不值得去。
                </div>

                {post.place_name && post.title !== post.place_name && (
                  <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      原貼文標題
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900">{post.title}</div>
                  </div>
                )}

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      地點
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {post.place_name || "未提供店名"}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {formatLocation(post) || "未提供地點資訊"}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      起始價格
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {formatPrice(post.price_from ?? plans[0]?.price ?? 0, post.country) || "依方案而定"}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      實際價格會依你選擇的踩坑方案而不同
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-amber-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                  避坑提醒
                </span>
                <div className="text-sm font-semibold text-slate-900">先看清楚，再決定要不要踩</div>
              </div>

              <div className="mt-4 grid gap-3">
                {pitfallItems.length > 0 ? (
                  pitfallItems.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-[20px] border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-slate-700"
                    >
                      {item}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    目前尚未整理出明確的避坑重點，建議先閱讀原貼文內容再決定。
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  原文內容摘要
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {post.content}
                </p>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                選擇你的踩坑方案
              </div>

              <div className="mt-4 space-y-3">
                {plans.map((plan) => {
                  const active = selectedPlanId === plan.id;

                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white shadow-md"
                          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold">{plan.name}</div>
                          <div className={`mt-1 text-sm ${active ? "text-white/80" : "text-slate-500"}`}>
                            {plan.desc}
                          </div>
                        </div>

                        {plan.tag && (
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                              active
                                ? "bg-white/15 text-white"
                                : "border border-orange-200 bg-orange-50 text-orange-700"
                            }`}
                          >
                            {plan.tag}
                          </span>
                        )}
                      </div>

                      <div className={`mt-4 text-lg font-black ${active ? "text-white" : "text-slate-900"}`}>
                        {formatPrice(plan.price, post.country)}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">預計日期</label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">數量 / 人數</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      −
                    </button>

                    <div className="min-w-[56px] text-center text-lg font-black text-slate-900">
                      {quantity}
                    </div>

                    <button
                      onClick={() => setQuantity((prev) => prev + 1)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      ＋
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                訂單摘要
              </div>

              <div className="mt-4 rounded-[24px] bg-slate-50 p-4">
                <div className="text-sm font-bold text-slate-900">{selectedPlan?.name || "尚未選擇方案"}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {selectedPlan?.desc || "請先選擇你的踩坑方式"}
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>單價</span>
                  <span>{selectedPlan ? formatPrice(selectedPlan.price, post.country) : "-"}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>數量</span>
                  <span>{quantity}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>平台服務費</span>
                  <span>{formatPrice(serviceFee, post.country)}</span>
                </div>

                <div className="border-t border-slate-200 pt-3 text-base font-black text-slate-900">
                  <div className="flex items-center justify-between">
                    <span>合計</span>
                    <span>{formatPrice(total, post.country)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {purchaseHref !== "#" ? (
                  <a
                    href={purchaseHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    {post.try_button_label?.trim() || "親自踩坑"}
                  </a>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                    onClick={() => alert("目前此頁面先完成 UI，下一步可接正式付款或預訂流程。")}
                  >
                    {post.try_button_label?.trim() || "親自踩坑"}
                  </button>
                )}

                <Link
                  href={`/#post-${post.id}`}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  回原貼文再看一次
                </Link>

                {post.google_maps_url && (
                  <a
                    href={post.google_maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    查看 Google 店家
                  </a>
                )}
              </div>

              <div className="mt-5 rounded-[22px] border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-slate-700">
                這個頁面目前是「內容導購版」。
                也就是讓用戶看完避坑資訊後，仍可選擇親自體驗。
                下一步你可以再接正式付款、預約表單、票券、餐券或 affiliate 連結。
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}