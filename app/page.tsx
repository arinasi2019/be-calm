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
  media_urls?: MediaItem[] | null;
  author_profile?: Profile | null;
  hashtags?: string[] | null;
};

type CompanionType = "一個人" | "情侶" | "朋友" | "家庭親子" | "長輩同行";

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);

  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("3");
  const [spotsInput, setSpotsInput] = useState("");
  const [companion, setCompanion] = useState<CompanionType>("情侶");
  const [style, setStyle] = useState("輕鬆一點");

  const [hasPlanned, setHasPlanned] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  function parseSpots(input: string) {
    return input
      .split(/[\n,，、]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const parsedSpots = useMemo(() => parseSpots(spotsInput), [spotsInput]);

  useEffect(() => {
    async function loadPosts() {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .order("id", { ascending: false });

      setPosts(data || []);
    }
    loadPosts();
  }, []);

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
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <SiteHeader />

        {/* AI FORM */}
        <div className="rounded-[28px] bg-white p-6 shadow">
          <h2 className="text-xl font-black">AI 行程診斷</h2>

          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="你要去哪裡"
            className="mt-4 w-full rounded-xl border p-3"
          />

          <input
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="mt-3 w-full rounded-xl border p-3"
          />

          <textarea
            value={spotsInput}
            onChange={(e) => setSpotsInput(e.target.value)}
            placeholder="想去的地方"
            className="mt-3 w-full rounded-xl border p-3"
          />

          <button
            onClick={handlePlanNow}
            className="mt-4 w-full rounded-full bg-black py-3 text-white"
          >
            開始診斷我的行程
          </button>
        </div>

        {/* AI RESULT */}
        {hasPlanned && (
          <div className="mt-6 space-y-6">
            {/* 避坑 */}
            <div className="rounded-2xl bg-white p-5 shadow">
              <h3 className="font-bold">AI 避坑提醒</h3>

              {loadingAI ? (
                <div className="mt-3 text-sm">AI 分析中...</div>
              ) : (
                aiResult?.warnings?.map((w: string, i: number) => (
                  <div key={i} className="mt-2 text-sm text-red-600">
                    ⚠ {w}
                  </div>
                ))
              )}
            </div>

            {/* 行程 */}
            <div className="rounded-2xl bg-white p-5 shadow">
              <h3 className="font-bold">優化行程</h3>

              {aiResult?.optimizedPlan?.map((p: string, i: number) => (
                <div key={i} className="mt-2 text-sm">
                  {i + 1}. {p}
                </div>
              ))}
            </div>

            {/* 預約 */}
            <div className="rounded-2xl bg-white p-5 shadow">
              <h3 className="font-bold">預約建議</h3>

              {aiResult?.bookingSuggestions?.map((b: string, i: number) => (
                <div key={i} className="mt-2 text-sm text-green-700">
                  {b}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}