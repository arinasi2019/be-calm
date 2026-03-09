"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";

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

const INCIDENT_TYPES = ["詐騙", "交易糾紛", "感情雷點", "工作/求職", "其他警示"];
const RISK_LEVELS = ["低", "中", "高"] as const;

type MediaItem = {
  type: "image" | "video";
  url: string;
};

export default function WritePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [pageReady, setPageReady] = useState(false);

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
  const [legalConfirmed, setLegalConfirmed] = useState(false);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isIncident = category === "人物/事件";

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    setPageReady(true);
  }, [authLoading, user, router]);

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
    const fileExt = file.name.split(".").pop();
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      alert("請先登入");
      router.push("/login");
      return;
    }

    if (!title.trim()) {
      alert("請填寫標題");
      return;
    }

    if (!content.trim()) {
      alert("請填寫內容");
      return;
    }

    if (isIncident) {
      if (!incidentType) {
        alert("請先選擇事件類型");
        return;
      }

      if (!legalConfirmed) {
        alert("請先勾選法律提醒確認");
        return;
      }
    }

    setLoading(true);
    setSubmitted(false);

    try {
      let mediaItems: MediaItem[] = [];

      if (imageFiles.length > 0) {
        const uploadedImages = await uploadMultipleFiles(imageFiles, "images", "image");
        mediaItems = [...mediaItems, ...uploadedImages];
      }

      if (videoFiles.length > 0) {
        const uploadedVideos = await uploadMultipleFiles(videoFiles, "videos", "video");
        mediaItems = [...mediaItems, ...uploadedVideos];
      }

      const firstVideo = mediaItems.find((item) => item.type === "video")?.url || null;
      const firstImage = mediaItems.find((item) => item.type === "image")?.url || null;

      const { error } = await supabase.from("posts").insert([
        {
          user_id: user.id,
          title: title.trim(),
          category,
          country,
          city: city.trim() || null,
          location: location.trim() || null,
          place_name: placeName.trim() || null,
          google_maps_url: googleMapsUrl.trim() || null,
          external_url: externalUrl.trim() || null,
          content: content.trim(),
          image_url: firstImage,
          video_url: firstVideo,
          media_urls: mediaItems,
          incident_type: isIncident ? incidentType : null,
          risk_level: isIncident ? riskLevel : null,
          content_type: isIncident ? "incident" : "normal",
        },
      ]);

      if (error) {
        alert("發文失敗：" + error.message);
        setLoading(false);
        return;
      }

      setSubmitted(true);
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
      setLegalConfirmed(false);
      setImageFiles([]);
      setVideoFiles([]);
      setLoading(false);

      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch (error: any) {
      setLoading(false);
      alert("上傳失敗：" + (error?.message || "未知錯誤"));
    }
  }

  if (authLoading || !pageReady) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
        <div className="mx-auto max-w-2xl">
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <h1 className="text-2xl font-black">發一篇避坑</h1>
            <p className="mt-2 text-sm text-slate-500">正在確認登入狀態...</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black">發一篇避坑</h1>
              <p className="mt-1 text-sm text-slate-500">
                選類別、國家、城市，讓之後的排行榜和篩選更準。
              </p>
            </div>

            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
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
                placeholder="請寫下你實際遇到的問題..."
                rows={7}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                required
              />
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
                <p className="mt-2 text-xs text-slate-500">
                  已選擇 {imageFiles.length} 張照片
                </p>
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
                <p className="mt-2 text-xs text-slate-500">
                  已選擇 {videoFiles.length} 支影片
                </p>
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
              disabled={loading}
              className="rounded-full bg-slate-900 px-6 py-3 text-white disabled:opacity-50"
            >
              {loading ? "送出中..." : "送出貼文"}
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