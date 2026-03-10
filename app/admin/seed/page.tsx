"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
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

type MediaItem = {
  type: "image" | "video";
  url: string;
};

const ADMIN_EMAILS = [
  "liam@arinasi.com",
  // 例如 "liang@example.com"
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
  const [publishedAt, setPublishedAt] = useState("");

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);

  const [saving, setSaving] = useState(false);

  const isIncident = category === "人物/事件";
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!isAdmin) {
      router.replace("/");
    }
  }, [user, loading, isAdmin, router]);

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      router.push("/login");
      return;
    }

    if (!isAdmin) {
      alert("你沒有後台權限");
      return;
    }

    if (isIncident && !incidentType) {
      alert("請先選擇事件類型");
      return;
    }

    setSaving(true);

    try {
      const finalPublishedAt = publishedAt
        ? new Date(publishedAt).toISOString()
        : new Date().toISOString();

      let mediaItems: MediaItem[] = [];

      // 先上傳影片，再上傳照片 → 保證顯示順序影片在前
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

      const { error } = await supabase.from("posts").insert([
        {
          user_id: user.id,
          title,
          category,
          country,
          city: city || null,
          location,
          place_name: placeName || null,
          google_maps_url: googleMapsUrl || null,
          external_url: externalUrl || null,
          content,
          image_url: firstImage,
          video_url: firstVideo,
          media_urls: mediaItems,
          incident_type: isIncident ? incidentType : null,
          risk_level: isIncident ? riskLevel : null,
          content_type: isIncident ? "incident" : "normal",
          is_seed: false,
          seed_author_name: null,
          seed_author_slug: null,
          source_type: "admin",
          is_featured: false,
          published_at: finalPublishedAt,
          created_at: finalPublishedAt,
        },
      ]);

      if (error) {
        alert("後台發文失敗：" + error.message);
        setSaving(false);
        return;
      }

      alert("後台貼文已建立");

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
      setPublishedAt("");
      setImageFiles([]);
      setVideoFiles([]);
      setSaving(false);

      router.push("/");
      router.refresh();
    } catch (error: any) {
      alert("上傳失敗：" + error.message);
      setSaving(false);
    }
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

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="text-lg font-bold text-slate-900">沒有權限</div>
          <p className="mt-2 text-sm text-slate-500">
            這個頁面只開放給管理員帳號使用。
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
          >
            回首頁
          </Link>
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
              <h1 className="text-2xl font-black">管理員後台發文</h1>
              <p className="mt-1 text-sm text-slate-500">
                這裡發的文會直接顯示為你的管理員帳號貼文。
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
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              後台發文會使用目前登入的管理員帳號顯示。可上傳影片與照片，且會先顯示影片，再顯示照片。
            </div>

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
                      ? "例如：IG / 某社群 / 某交易群"
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
                    ? "例如：某交易平台 / 某對象"
                    : "例如：OO燒肉 / XX行李箱 / 某一日遊"
                }
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
                placeholder="寫下你的避坑內容..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">發布時間（可留空）</label>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
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
                  已選擇 {videoFiles.length} 支影片（會優先顯示）
                </p>
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
                <p className="mt-2 text-xs text-slate-500">
                  已選擇 {imageFiles.length} 張照片
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-slate-900 px-6 py-3 text-white disabled:opacity-50"
            >
              {saving ? "送出中..." : "用管理員帳號發文"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}