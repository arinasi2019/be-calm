"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";

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

export default function WritePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("店家");
  const [country, setCountry] = useState("日本");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSubmitted(false);

    try {
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;

      if (imageFile) {
        imageUrl = await uploadFile(imageFile, "images");
      }

      if (videoFile) {
        videoUrl = await uploadFile(videoFile, "videos");
      }

      const { error } = await supabase.from("posts").insert([
        {
          title,
          category,
          country,
          city,
          location,
          place_name: placeName || null,
          google_maps_url: googleMapsUrl || null,
          content,
          image_url: imageUrl,
          video_url: videoUrl,
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
      setContent("");
      setImageFile(null);
      setVideoFile(null);
      setLoading(false);

      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch (error: any) {
      setLoading(false);
      alert("上傳失敗：" + error.message);
    }
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
                <label className="mb-2 block text-sm font-medium">地區 / 店名</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="例如：涉谷 / 信義區 / 某某飯店"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">店家 / 商品名稱</label>
              <input
                type="text"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder="例如：OO燒肉 / XX行李箱 / 某一日遊"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Google Maps 連結（有店家再填）</label>
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="貼上 Google Maps 店家連結"
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
              <label className="mb-2 block text-sm font-medium">照片</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="block w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">影片</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="block w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </div>

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