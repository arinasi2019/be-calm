"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function WritePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("商品避坑");
  const [location, setLocation] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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
          location,
          place_name: placeName || null,
          google_maps_url: googleMapsUrl || null,
          content,
          image_url: imageUrl,
          video_url: videoUrl,
        },
      ]);

      setLoading(false);

      if (error) {
        alert("發文失敗：" + error.message);
        return;
      }

      setSubmitted(true);
      setTitle("");
      setCategory("商品避坑");
      setLocation("");
      setPlaceName("");
      setGoogleMapsUrl("");
      setContent("");
      setImageFile(null);
      setVideoFile(null);

      setTimeout(() => {
        router.push("/");
      }, 1200);
    } catch (error: any) {
      setLoading(false);
      alert("上傳失敗：" + error.message);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/60">
          <div className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-sm text-white">
            避坑 Be Calm
          </div>

          <h1 className="mt-4 text-3xl font-black">我要發文</h1>
          <p className="mt-2 text-slate-600">
            把你踩過的雷寫下來，幫更多人避坑。
          </p>

          <div className="mt-4">
            <Link
              href="/"
              className="inline-block rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
            >
              ← 回首頁
            </Link>
          </div>
        </section>

        <section className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/60">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                標題
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：這家餐廳排隊很久但很普通"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                類別
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
              >
                <option>商品避坑</option>
                <option>旅遊踩雷</option>
                <option>餐飲雷店</option>
                <option>服務體驗落差</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                地區 / 店名
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例如：東京涉谷 / 某某餐廳"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Google 店家名稱
              </label>
              <input
                type="text"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder="例如：句子咖啡店"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Google Maps 連結
              </label>
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="貼上 Google Maps 店家連結"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                內容
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="請寫下你實際遇到的問題..."
                rows={8}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                上傳照片
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="block w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                上傳影片
              </label>
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
              className="rounded-full bg-slate-900 px-6 py-3 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "送出中..." : "送出貼文"}
            </button>
          </form>

          {submitted && (
            <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700">
              發文成功，已寫入資料庫，正在返回首頁...
            </div>
          )}
        </section>
      </div>
    </main>
  );
}