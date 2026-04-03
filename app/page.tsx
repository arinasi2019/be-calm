"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import { supabase } from "./lib/supabase";

/* ===== 型別（原本保留） ===== */

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

/* ===== 工具函數（原本保留） ===== */

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function parseSpots(input: string) {
  return input
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/* ===== 主頁 ===== */

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("3");
  const [spotsInput, setSpotsInput] = useState("");
  const [companion, setCompanion] = useState<CompanionType>("情侶");
  const [style, setStyle] = useState("輕鬆一點");

  const [hasPlanned, setHasPlanned] = useState(false);

  // 🔥 新增 AI
  const [aiResult, setAiResult] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    async function loadTravelPosts() {
      const postsRes = await supabase
        .from("posts")
        .select("*")
        .eq("category", "旅遊")
        .order("id", { ascending: false });

      setPosts((postsRes.data as Post[]) || []);
    }

    loadTravelPosts();
  }, []);

  const parsedSpots = useMemo(() => parseSpots(spotsInput), [spotsInput]);

  // 🔥 改成 AI
  async function handlePlanNow() {
    if (!destination.trim()) {
      alert("請先輸入目的地");
      return;
    }

    setHasPlanned(true);
    setLoadingAI(true);

    try {
      const res = await fetch("/api/plan", {
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
        }),
      });

      const data = await res.json();
      setAiResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAI(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] pb-16 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-5 sm:py-6">
        <SiteHeader />

        {/* ===== AI HERO（保留） ===== */}
        <section className="rounded-[34px] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#1e293b] p-6 text-white">
          <h1 className="text-3xl font-black">
            把你的旅行計畫丟進來，先避坑，再出發
          </h1>

          <div className="mt-6 space-y-3">
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="去哪裡"
              className="w-full rounded-xl p-3 text-black"
            />

            <input
              type="number"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-xl p-3 text-black"
            />

            <textarea
              value={spotsInput}
              onChange={(e) => setSpotsInput(e.target.value)}
              placeholder="想去的景點"
              className="w-full rounded-xl p-3 text-black"
            />

            <button
              onClick={handlePlanNow}
              className="w-full rounded-full bg-white py-3 text-black"
            >
              開始診斷
            </button>
          </div>
        </section>

        {/* ===== AI RESULT（升級） ===== */}
        {hasPlanned && (
          <section className="mt-6 space-y-6">

            {loadingAI && (
              <div className="rounded-2xl bg-white p-6 text-center shadow">
                AI 分析中...
              </div>
            )}

            {!loadingAI && aiResult && (
              <>
                {/* 避坑 */}
                <div className="rounded-2xl bg-white p-6 shadow">
                  <h2 className="text-xl font-black">⚠ 避坑提醒</h2>

                  {aiResult.warnings.map((w: string, i: number) => (
                    <div key={i} className="mt-2 text-red-600">
                      {w}
                    </div>
                  ))}
                </div>

                {/* 行程 */}
                <div className="rounded-2xl bg-white p-6 shadow">
                  <h2 className="text-xl font-black">✨ 行程優化</h2>

                  {aiResult.optimizedPlan.map((p: string, i: number) => (
                    <div key={i} className="mt-2">
                      {i + 1}. {p}
                    </div>
                  ))}
                </div>

                {/* 🔥 導購（最重要） */}
                <div className="rounded-2xl bg-white p-6 shadow">
                  <h2 className="text-xl font-black">🔥 建議直接預約</h2>

                  <div className="grid gap-4 md:grid-cols-2">
                    {aiResult.bookingSuggestions.map((b: string, i: number) => (
                      <div key={i} className="border p-4 rounded-xl">
                        <div className="font-bold">{b}</div>

                        <button
                          className="mt-3 w-full rounded-full bg-black py-2 text-white"
                          onClick={() => {
                            alert("這裡接你的包車 / Klook");
                          }}
                        >
                          立即預約
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* ===== 下面全部保留你原本 feed ===== */}
      </div>
    </main>
  );
}