"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";

const COUNTRY_OPTIONS = [
  "日本",
  "台灣",
  "韓國",
  "中國",
  "香港",
  "新加坡",
  "泰國",
  "越南",
  "馬來西亞",
  "印尼",
  "菲律賓",
  "澳洲",
  "紐西蘭",
  "美國",
  "加拿大",
  "英國",
  "法國",
  "德國",
  "義大利",
  "西班牙",
  "其他",
];

const INCIDENT_TYPES = ["詐騙", "交易糾紛", "感情雷點", "工作/求職", "其他警示"];
const RISK_LEVELS = ["低", "中", "高"] as const;

function normalizeHashtagTag(tag: string) {
  return tag
    .replace(/^#+/, "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[，、。,.!?！？”“"'`()\[\]{}<>/\\]/g, "")
    .toLowerCase();
}

function extractHashtagsFromPost(params: {
  title: string;
  content: string;
  category: string;
  country: string;
  city: string;
  location: string;
  placeName: string;
  incidentType?: string;
}) {
  const manualMatches = `${params.title} ${params.content}`.match(/#[\p{L}\p{N}_-]+/gu) || [];

  const manualTags = manualMatches.map(normalizeHashtagTag).filter(Boolean);

  const autoTags = [
    params.category,
    params.country,
    params.city,
    params.location,
    params.placeName,
    params.incidentType || "",
    params.category ? `${params.category}避坑` : "",
    params.country ? `${params.country}避坑` : "",
    params.city ? `${params.city}避坑` : "",
  ]
    .map((item) => normalizeHashtagTag(item || ""))
    .filter(Boolean);

  return Array.from(new Set([...manualTags, ...autoTags])).slice(0, 20);
}

type PostRow = {
  id: number;
  user_id?: string | null;
  title: string;
  category: string;
  country?: string | null;
  city?: string | null;
  location?: string | null;
  place_name?: string | null;
  google_maps_url?: string | null;
  external_url?: string | null;
  content: string;
  hashtags?: string[] | null;
  incident_type?: string | null;
  risk_level?: "低" | "中" | "高" | null;
  content_type?: "normal" | "incident" | null;
  can_try?: boolean | null;
  booking_url?: string | null;
  price_from?: number | null;
  try_button_label?: string | null;
  pitfall_summary?: string[] | null;
};

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("店家");
  const [country, setCountry] = useState("日本");
  const [customCountry, setCustomCountry] = useState("");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [content, setContent] = useState("");

  const [incidentType, setIncidentType] = useState("");
  const [riskLevel, setRiskLevel] = useState<"低" | "中" | "高">("中");

  const [canTry, setCanTry] = useState(false);
  const [priceFrom, setPriceFrom] = useState("");
  const [tryButtonLabel, setTryButtonLabel] = useState("親自踩坑");
  const [bookingUrl, setBookingUrl] = useState("");
  const [pitfallSummaryText, setPitfallSummaryText] = useState("");

  const isIncident = category === "人物/事件";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function loadPost() {
      if (!user || !params?.id) return;

      setPageLoading(true);

      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", Number(params.id))
        .single();

      if (error || !data) {
        alert("找不到這篇貼文");
        router.replace("/");
        return;
      }

      const post = data as PostRow;

      if (post.user_id !== user.id) {
        alert("你沒有編輯這篇貼文的權限");
        router.replace(`/post/${params.id}`);
        return;
      }

      setTitle(post.title || "");
      setCategory(post.category || "店家");

      const loadedCountry = post.country || "日本";
      if (COUNTRY_OPTIONS.includes(loadedCountry)) {
        setCountry(loadedCountry);
        setCustomCountry("");
      } else {
        setCountry("其他");
        setCustomCountry(loadedCountry);
      }

      setCity(post.city || "");
      setLocation(post.location || "");
      setPlaceName(post.place_name || "");
      setGoogleMapsUrl(post.google_maps_url || "");
      setExternalUrl(post.external_url || "");
      setContent(post.content || "");
      setIncidentType(post.incident_type || "");
      setRiskLevel((post.risk_level as "低" | "中" | "高") || "中");
      setCanTry(Boolean(post.can_try || post.booking_url));
      setPriceFrom(post.price_from != null ? String(post.price_from) : "");
      setTryButtonLabel(post.try_button_label || "親自踩坑");
      setBookingUrl(post.booking_url || "");
      setPitfallSummaryText(Array.isArray(post.pitfall_summary) ? post.pitfall_summary.join("\n") : "");

      setPageLoading(false);
    }

    loadPost();
  }, [user, params, router]);

  const previewHashtags = useMemo(() => {
    const finalCountry = country === "其他" ? customCountry.trim() : country;

    return extractHashtagsFromPost({
      title,
      content,
      category,
      country: finalCountry,
      city,
      location,
      placeName,
      incidentType: isIncident ? incidentType : "",
    });
  }, [
    title,
    content,
    category,
    country,
    customCountry,
    city,
    location,
    placeName,
    incidentType,
    isIncident,
  ]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user || !params?.id) return;

    if (isIncident && !incidentType) {
      alert("請先選擇事件類型");
      return;
    }

    if (canTry && priceFrom.trim() !== "" && Number.isNaN(Number(priceFrom))) {
      alert("起始價格請填數字");
      return;
    }

    if (country === "其他" && !customCountry.trim()) {
      alert("請輸入其他國家名稱");
      return;
    }

    setSaving(true);

    try {
      const finalCountry = country === "其他" ? customCountry.trim() : country;

      const hashtags = extractHashtagsFromPost({
        title,
        content,
        category,
        country: finalCountry,
        city,
        location,
        placeName,
        incidentType: isIncident ? incidentType : "",
      });

      const pitfallSummary = pitfallSummaryText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      const updatePayload = {
        title,
        category,
        country: finalCountry,
        city: city || null,
        location,
        place_name: placeName || null,
        google_maps_url: googleMapsUrl || null,
        external_url: externalUrl || null,
        content,
        hashtags,
        incident_type: isIncident ? incidentType : null,
        risk_level: isIncident ? riskLevel : null,
        content_type: isIncident ? "incident" : "normal",
        can_try: canTry,
        booking_url: canTry ? bookingUrl || null : null,
        price_from: canTry && priceFrom ? Number(priceFrom) : null,
        try_button_label: canTry ? tryButtonLabel || "親自踩坑" : null,
        pitfall_summary: canTry ? (pitfallSummary.length ? pitfallSummary : null) : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("posts")
        .update(updatePayload)
        .eq("id", Number(params.id))
        .eq("user_id", user.id);

      if (error) {
        alert("更新失敗：" + error.message);
        setSaving(false);
        return;
      }

      alert("貼文已更新");
      router.push(`/post/${params.id}`);
      router.refresh();
    } catch (error: any) {
      alert("更新失敗：" + (error?.message || "未知錯誤"));
      setSaving(false);
    }
  }

  if (loading || !user || pageLoading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          載入中...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-black">編輯貼文</h1>
              <p className="mt-1 text-sm text-slate-500">修改後會直接更新原貼文。</p>
            </div>

            <Link
              href={`/post/${params.id}`}
              className="flex h-12 min-w-[96px] shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700"
            >
              回貼文
            </Link>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">標題</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">類別</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                >
                  <option>店家</option>
                  <option>商品</option>
                  <option>旅遊</option>
                  <option>服務</option>
                  <option>人物/事件</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">國家</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                >
                  {COUNTRY_OPTIONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>

                {country === "其他" && (
                  <div className="mt-3">
                    <label className="mb-2 block text-sm font-medium">其他國家</label>
                    <input
                      type="text"
                      value={customCountry}
                      onChange={(e) => setCustomCountry(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">城市</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  {isIncident ? "發生地區 / 對象簡稱" : "地區 / 店名"}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {isIncident ? "人物 / 事件名稱" : "店家 / 商品名稱"}
              </label>
              <input
                type="text"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            {isIncident && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">事件類型</label>
                  <select
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                  >
                    <option value="">請選擇</option>
                    {INCIDENT_TYPES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">風險等級</label>
                  <select
                    value={riskLevel}
                    onChange={(e) => setRiskLevel(e.target.value as "低" | "中" | "高")}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                  >
                    {RISK_LEVELS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium">Google Maps 連結</label>
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">外部連結</label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">內容</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                required
              />
            </div>

            {previewHashtags.length > 0 && (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                <div className="mb-2 text-sm font-semibold text-slate-900">預覽 hashtag</div>
                <div className="flex flex-wrap gap-2">
                  {previewHashtags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-medium text-sky-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[24px] border border-orange-200 bg-orange-50/70 p-4">
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-900">
                <input
                  type="checkbox"
                  checked={canTry}
                  onChange={(e) => setCanTry(e.target.checked)}
                />
                開啟「親自踩坑」
              </label>

              {canTry && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">起始價格</label>
                    <input
                      type="text"
                      value={priceFrom}
                      onChange={(e) => setPriceFrom(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">按鈕文字</label>
                    <input
                      type="text"
                      value={tryButtonLabel}
                      onChange={(e) => setTryButtonLabel(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">外部購買連結</label>
                    <input
                      type="url"
                      value={bookingUrl}
                      onChange={(e) => setBookingUrl(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">避坑提醒（一行一點）</label>
                    <textarea
                      value={pitfallSummaryText}
                      onChange={(e) => setPitfallSummaryText(e.target.value)}
                      rows={5}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-slate-900 px-6 py-3 text-white disabled:opacity-50"
              >
                {saving ? "儲存中..." : "儲存變更"}
              </button>

              <Link
                href={`/post/${params.id}`}
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-slate-700"
              >
                取消
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}