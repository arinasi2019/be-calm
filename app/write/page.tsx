"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";

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

type MediaItem = {
  type: "image" | "video";
  url: string;
};

function normalizeHashtagTag(tag: string) {
  return String(tag || "")
    .replace(/^#+/, "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[，、。,.!?！？”“"'`()\[\]{}<>/\\]/g, "")
    .toLowerCase();
}

function extractManualHashtags(text: string) {
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) || [];
  return matches.map(normalizeHashtagTag).filter(Boolean);
}

function buildHashtags(params: {
  title: string;
  content: string;
  category: string;
  country: string;
  city: string;
  location: string;
  placeName: string;
  incidentType?: string;
}) {
  const manualTags = extractManualHashtags(`${params.title} ${params.content}`);

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
    .map(normalizeHashtagTag)
    .filter(Boolean);

  return Array.from(new Set([...manualTags, ...autoTags])).slice(0, 20);
}

export default function WritePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

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
  const [legalConfirmed, setLegalConfirmed] = useState(false);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  async function compressImage(file: File) {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
    };

    try {
      return await imageCompression(file, options);
    } catch {
      return file;
    }
  }

  async function uploadFile(file: File, folder: string) {
    const fileExt = file.name.split(".").pop() || "bin";
    const fileName = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExt}`;

    const { error } = await supabase.storage.from("media").upload(fileName, file);

    if (error) throw error;

    const { data } = supabase.storage.from("media").getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function uploadMultipleFiles(
    files: File[],
    folder: string,
    type: "image" | "video"
  ): Promise<MediaItem[]> {
    const uploaded: MediaItem[] = [];

    for (const file of files) {
      const actualFile = type === "image" ? await compressImage(file) : file;
      const url = await uploadFile(actualFile, folder);
      uploaded.push({ type, url });
    }

    return uploaded;
  }

  const previewHashtags = useMemo(() => {
    const finalCountry = country === "其他" ? customCountry.trim() : country;

    return buildHashtags({
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      router.push("/login");
      return;
    }

    if (!title.trim()) {
      alert("請先填寫標題");
      return;
    }

    if (!content.trim()) {
      alert("請先填寫內容");
      return;
    }

    setLoadingSubmit(true);
    setSubmitted(false);

    if (isIncident) {
      if (!incidentType) {
        alert("請先選擇事件類型");
        setLoadingSubmit(false);
        return;
      }

      if (!legalConfirmed) {
        alert("請先勾選法律提醒確認");
        setLoadingSubmit(false);
        return;
      }
    }

    if (canTry && priceFrom.trim() !== "" && Number.isNaN(Number(priceFrom))) {
      alert("起始價格請填數字");
      setLoadingSubmit(false);
      return;
    }

    if (country === "其他" && !customCountry.trim()) {
      alert("請輸入其他國家名稱");
      setLoadingSubmit(false);
      return;
    }

    try {
      const finalCountry = country === "其他" ? customCountry.trim() : country;

      const hashtags = buildHashtags({
        title,
        content,
        category,
        country: finalCountry,
        city,
        location,
        placeName,
        incidentType: isIncident ? incidentType : "",
      });

      let mediaItems: MediaItem[] = [];

      // 固定先影片後圖片，和前台顯示邏輯更一致
      if (videoFiles.length > 0) {
        const uploadedVideos = await uploadMultipleFiles(videoFiles, "videos", "video");
        mediaItems = [...mediaItems, ...uploadedVideos];
      }

      if (imageFiles.length > 0) {
        const uploadedImages = await uploadMultipleFiles(imageFiles, "images", "image");
        mediaItems = [...mediaItems, ...uploadedImages];
      }

      const firstVideo = mediaItems.find((item) => item.type === "video")?.url || null;
      const firstImage = mediaItems.find((item) => item.type === "image")?.url || null;

      const pitfallSummary = pitfallSummaryText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      const payload = {
        user_id: user.id,
        title: title.trim(),
        category,
        country: finalCountry,
        city: city.trim() || null,
        location: location.trim(),
        place_name: placeName.trim() || null,
        google_maps_url: googleMapsUrl.trim() || null,
        external_url: externalUrl.trim() || null,
        content: content.trim(),
        hashtags,
        image_url: firstImage,
        video_url: firstVideo,
        media_urls: mediaItems,
        incident_type: isIncident ? incidentType : null,
        risk_level: isIncident ? riskLevel : null,
        content_type: isIncident ? "incident" : "normal",
        can_try: canTry,
        booking_url: canTry ? bookingUrl.trim() || null : null,
        price_from: canTry && priceFrom ? Number(priceFrom) : null,
        try_button_label: canTry ? tryButtonLabel.trim() || "親自踩坑" : null,
        pitfall_summary: canTry ? (pitfallSummary.length ? pitfallSummary : null) : null,
      };

      const { error } = await supabase.from("posts").insert([payload]);

      if (error) {
        alert("發文失敗：" + error.message);
        setLoadingSubmit(false);
        return;
      }

      setSubmitted(true);

      setTitle("");
      setCategory("店家");
      setCountry("日本");
      setCustomCountry("");
      setCity("");
      setLocation("");
      setPlaceName("");
      setGoogleMapsUrl("");
      setExternalUrl("");
      setContent("");
      setIncidentType("");
      setRiskLevel("中");
      setLegalConfirmed(false);
      setImageFiles([]);
      setVideoFiles([]);
      setCanTry(false);
      setPriceFrom("");
      setTryButtonLabel("親自踩坑");
      setBookingUrl("");
      setPitfallSummaryText("");
      setLoadingSubmit(false);

      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch (error: any) {
      setLoadingSubmit(false);
      alert("上傳失敗：" + (error?.message || "未知錯誤"));
    }
  }

  if (loading || !user) {
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
              <h1 className="text-2xl font-black">發一篇避坑</h1>
              <p className="mt-1 text-sm text-slate-500">
                選類別、國家、城市，讓之後的排行榜和篩選更準。
              </p>
            </div>

            <Link
              href="/"
              className="flex h-12 min-w-[96px] shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700"
            >
              回首頁
            </Link>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">標題</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：東京這家店排很久但真的不值得"
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
                      placeholder="請輸入國家名稱，例如：冰島 / 土耳其 / 秘魯"
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
                  placeholder={
                    isIncident
                      ? "例如：IG / 某交友對象 / 某群組"
                      : "例如：涉谷 / 信義區 / 某某飯店"
                  }
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
                placeholder={
                  isIncident
                    ? "例如：某投資群 / 某平台 / 某對象"
                    : "例如：OO燒肉 / XX行李箱 / 某一日遊"
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            {isIncident && (
              <>
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

                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  人物 / 事件類內容請避免公開個資，並以真實經驗敘述為主，不要直接做定罪式指控。
                </div>
              </>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium">
                Google Maps 連結（有店家再填）
              </label>
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="貼上 Google Maps 店家連結"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                外部連結（商品 / 官網 / 景點 / 事件參考）
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="貼上商品頁、官網或其他參考連結"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">內容</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="請寫下你實際遇到的問題，可直接在內容中輸入 #東京美食 #京都旅遊"
                rows={7}
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

              <p className="mt-2 text-sm leading-6 text-slate-600">
                用戶看完避坑內容後，如果還是想自己試試，就可以點進親自踩坑頁。
              </p>

              {canTry && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">起始價格</label>
                    <input
                      type="text"
                      value={priceFrom}
                      onChange={(e) => setPriceFrom(e.target.value)}
                      placeholder="例如：1200"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">按鈕文字</label>
                    <input
                      type="text"
                      value={tryButtonLabel}
                      onChange={(e) => setTryButtonLabel(e.target.value)}
                      placeholder="例如：親自踩坑"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">外部購買連結（可先留空）</label>
                    <input
                      type="url"
                      value={bookingUrl}
                      onChange={(e) => setBookingUrl(e.target.value)}
                      placeholder="例如：https://..."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">避坑提醒（一行一點）</label>
                    <textarea
                      value={pitfallSummaryText}
                      onChange={(e) => setPitfallSummaryText(e.target.value)}
                      rows={5}
                      placeholder={`例如：
排隊很久
價格偏高
主要是拍照感
服務兩極`}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">照片（可多選，會自動壓縮）</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
                className="block w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
              {imageFiles.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">已選擇 {imageFiles.length} 張照片</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">影片（可多選）</label>
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={(e) => setVideoFiles(Array.from(e.target.files || []))}
                className="block w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
              {videoFiles.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">已選擇 {videoFiles.length} 支影片</p>
              )}
            </div>

            {isIncident && (
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={legalConfirmed}
                  onChange={(e) => setLegalConfirmed(e.target.checked)}
                  className="mt-1"
                />
                <span>我確認此內容為真實經驗分享，且未公開他人敏感個資或散布不實指控。</span>
              </label>
            )}

            <button
              type="submit"
              disabled={loadingSubmit}
              className="rounded-full bg-slate-900 px-6 py-3 text-white disabled:opacity-50"
            >
              {loadingSubmit ? "送出中..." : "送出貼文"}
            </button>

            {submitted && (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                發文成功，正在返回首頁...
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}