"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import { supabase } from "./lib/supabase";

type CompanionType = "一個人" | "情侶" | "朋友" | "家庭親子" | "長輩同行";

type Post = any;

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
        .eq("category", "旅遊")
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
    <main className="min-h-screen bg-[#f5f7fb] pb-16 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-5 sm:py-6">
        <SiteHeader />

        {/* HERO + AI */}
        <section className="rounded-[34px] bg-gradient-to-br from-black to-slate-800 p-6 text-white">
          <h1 className="text-3xl font-black">
            AI 幫你避坑，直接優化旅遊行程
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
              className="w-full rounded-full bg-white py-3 font-bold text-black"
            >
              開始 AI 診斷
            </button>
          </div>
        </section>

        {/* AI RESULT */}
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
                  <h2 className="text-xl font-black">✨ 優化行程</h2>

                  {aiResult.optimizedPlan.map((p: string, i: number) => (
                    <div key={i} className="mt-2">
                      {i + 1}. {p}
                    </div>
                  ))}
                </div>

                {/* 商品 */}
                <div className="rounded-2xl bg-white p-6 shadow">
                  <h2 className="text-xl font-black">🔥 推薦預約</h2>

                  <div className="grid gap-4 md:grid-cols-2">
                    {aiResult.bookingSuggestions.map(
                      (b: string, i: number) => (
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
                      )
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* FEED */}
        <section className="mt-8">
          <h2 className="text-xl font-black">旅遊避坑分享</h2>

          <div className="mt-4 grid gap-4">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/post/${p.id}`}
                className="block rounded-xl bg-white p-4 shadow"
              >
                <div className="font-bold">{p.title}</div>
                <div className="text-sm text-slate-500 mt-1">
                  {p.content}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}