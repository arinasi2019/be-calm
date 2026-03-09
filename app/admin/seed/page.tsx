"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";

const COUNTRY_OPTIONS = [
  "日本",
  "台灣",
  "泰國",
  "澳洲",
  "韓國",
  "香港",
  "新加坡",
  "其他",
];

const CATEGORY_OPTIONS = ["店家", "商品", "旅遊", "服務", "人物/事件"];
const INCIDENT_TYPES = ["詐騙", "交易糾紛", "感情雷點", "工作/求職", "其他警示"];
const RISK_LEVELS = ["低", "中", "高"] as const;

const SEED_AUTHORS = [
  { name: "Be Calm 編輯部", slug: "becalm-editor" },
  { name: "商品避雷整理員", slug: "product-editor" },
  { name: "旅遊踩雷資料庫", slug: "travel-editor" },
  { name: "餐廳避坑觀察員", slug: "food-editor" },
  { name: "服務體驗整理站", slug: "service-editor" },
  { name: "事件警示整理員", slug: "incident-editor" },
];

export default function SeedAdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("店家");
  const [country, setCountry] = useState("日本");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [content, setContent] = useState("");

  const [incidentType, setIncidentType] = useState("");
  const [riskLevel, setRiskLevel] = useState<"低" | "中" | "高">("中");

  const [seedAuthorName, setSeedAuthorName] = useState(SEED_AUTHORS[0].name);
  const [seedAuthorSlug, setSeedAuthorSlug] = useState(SEED_AUTHORS[0].slug);
  const [isFeatured, setIsFeatured] = useState(false);
  const [publishedAt, setPublishedAt] = useState("");

  const [saving, setSaving] = useState(false);

  const isIncident = category === "人物/事件";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  function handleAuthorChange(value: string) {
    const found = SEED_AUTHORS.find((item) => item.slug === value);
    if (!found) return;
    setSeedAuthorName(found.name);
    setSeedAuthorSlug(found.slug);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      router.push("/login");
      return;
    }

    setSaving(true);

    const finalPublishedAt = publishedAt
      ? new Date(publishedAt).toISOString()
      : new Date().toISOString();

    const { error } = await supabase.from("posts").insert([
      {
        user_id: null,
        title,
        category,
        country,
        city: city || null,
        location,
        place_name: placeName || null,
        google_maps_url: googleMapsUrl || null,
        external_url: externalUrl || null,
        content,
        incident_type: isIncident ? incidentType || null : null,
        risk_level: isIncident ? riskLevel : null,
        content_type: isIncident ? "incident" : "normal",
        is_seed: true,
        seed_author_name: seedAuthorName,
        seed_author_slug: seedAuthorSlug,
        source_type: "seed",
        is_featured: isFeatured,
        published_at: finalPublishedAt,
        created_at: finalPublishedAt,
      },
    ]);

    setSaving(false);

    if (error) {
      alert("建立 seed 貼文失敗：" + error.message);
      return;
    }

    alert("Seed 貼文已建立");

    setTitle("");
    setCategory("店家");
    setCountry("日本");
    setCity("");
    setLocation("");
    setPlaceName("");
    setGoogleMapsUrl("");
    setExternalUrl("");
    setContent("");
    setIncidentType("");
    setRiskLevel("中");
    setSeedAuthorName(SEED_AUTHORS[0].name);
    setSeedAuthorSlug(SEED_AUTHORS[0].slug);
    setIsFeatured(false);
    setPublishedAt("");
  }

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          載入中...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black">Seed 後台發文</h1>
              <p className="mt-1 text-sm text-slate-500">
                用來建立平台前期的整理型內容，不綁一般會員。
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
              >
                回首頁
              </Link>
              <Link
                href="/profile"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
              >
                會員資料
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              這裡建立的是平台 seed 貼文。前台應顯示 seed 作者名稱，不應假裝成一般會員。
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Seed 作者</label>
                <select
                  value={seedAuthorSlug}
                  onChange={(e) => handleAuthorChange(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                >
                  {SEED_AUTHORS.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">發布時間</label>
                <input
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">類別</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                >
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
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
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">標題</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：這家拉麵排很久，但湯頭其實普通"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">城市</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="例如：東京 / 大阪 / 台北"
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
                  placeholder={isIncident ? "例如：IG / 某社團 / 某交易群" : "例如：涉谷 / 某商場 / 某飯店"}
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
                placeholder={isIncident ? "例如：某交易平台 / 某對象" : "例如：OO燒肉 / XX行李箱"}
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
                placeholder="貼上 Google Maps 店家連結"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">外部連結</label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="商品頁 / 官網 / 事件參考連結"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">內容</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder="寫下整理過的避坑重點..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
              />
              <span>設為精選貼文</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-slate-900 px-6 py-3 text-white disabled:opacity-50"
            >
              {saving ? "建立中..." : "建立 Seed 貼文"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}