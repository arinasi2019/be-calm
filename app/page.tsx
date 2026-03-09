"use client";

import { useEffect, useMemo, useState } from "react";
import PostFeed from "./components/PostFeed";
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
  location: string;
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
};

type Vote = {
  id: number;
  post_id: number;
};

type Comment = {
  id: number;
  post_id: number;
};

type RankedPost = Post & {
  pitCount: number;
  commentCount: number;
  hotScore: number;
  trendScore: number;
};

function getHoursAgo(dateString: string | null) {
  if (!dateString) return 999999;
  const created = new Date(dateString).getTime();
  const now = Date.now();
  return Math.max(1, (now - created) / (1000 * 60 * 60));
}

function getHotScore(post: Post, pitCount: number, commentCount: number) {
  const hoursAgo = getHoursAgo(post.created_at);
  return pitCount * 10 + commentCount * 4 + 100 / Math.pow(hoursAgo + 2, 0.7);
}

function getTrendScore(post: Post, pitCount: number, commentCount: number) {
  const hoursAgo = getHoursAgo(post.created_at);
  return (pitCount * 8 + commentCount * 3) / Math.pow(hoursAgo + 2, 0.8);
}

function RankingBlock({
  title,
  colorClass,
  posts,
  metricLabel,
}: {
  title: string;
  colorClass: string;
  posts: RankedPost[];
  metricLabel: "坑" | "留言" | "熱度";
}) {
  return (
    <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <h3 className={`text-base font-black ${colorClass}`}>{title}</h3>

      {posts.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">目前沒有資料</p>
      ) : (
        <div className="mt-4 space-y-3">
          {posts.map((post, index) => (
            <a
              key={post.id}
              href={`#post-${post.id}`}
              className="block rounded-2xl bg-slate-50 p-3 transition hover:bg-slate-100"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-bold text-slate-900">
                  #{index + 1} {post.title}
                </div>

                {post.category === "人物/事件" && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                    人物 / 事件
                  </span>
                )}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {[post.category, post.country, post.city].filter(Boolean).join("・")}
                {post.incident_type ? `・${post.incident_type}` : ""}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {metricLabel === "坑" && (
                  <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                    坑 {post.pitCount}
                  </span>
                )}

                {metricLabel === "留言" && (
                  <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                    留言 {post.commentCount}
                  </span>
                )}

                {metricLabel === "熱度" && (
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    熱度 {post.trendScore.toFixed(1)}
                  </span>
                )}

                {post.category === "人物/事件" && post.risk_level && (
                  <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                    風險 {post.risk_level}
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedCountry, setSelectedCountry] = useState("全部");
  const [selectedCity, setSelectedCity] = useState("全部");

  useEffect(() => {
    async function load() {
      const [postsRes, votesRes, commentsRes] = await Promise.all([
        supabase.from("posts").select("*").order("id", { ascending: false }),
        supabase.from("votes").select("id, post_id"),
        supabase.from("comments").select("id, post_id"),
      ]);

      const rawPosts = ((postsRes.data as Post[]) || []);
      const userIds = Array.from(
        new Set(rawPosts.map((post) => post.user_id).filter(Boolean) as string[])
      );

      let profileMap: Record<string, Profile> = {};

      if (userIds.length > 0) {
        const profilesRes = await supabase
          .from("profiles")
          .select("id, email, username, display_name")
          .in("id", userIds);

        if (!profilesRes.error) {
          ((profilesRes.data as Profile[]) || []).forEach((profile) => {
            profileMap[profile.id] = profile;
          });
        }
      }

      if (postsRes.error) {
        console.error("載入 posts 失敗：", postsRes.error.message);
      } else {
        const nextPosts = rawPosts.map((post) => ({
          ...post,
          author_profile: post.user_id ? profileMap[post.user_id] || null : null,
        }));
        setPosts(nextPosts);
      }

      if (votesRes.error) {
        console.error("載入 votes 失敗：", votesRes.error.message);
      } else {
        setVotes((votesRes.data as Vote[]) || []);
      }

      if (commentsRes.error) {
        console.error("載入 comments 失敗：", commentsRes.error.message);
      } else {
        setComments((commentsRes.data as Comment[]) || []);
      }
    }

    load();
  }, []);

  const categories = ["全部", "店家", "商品", "旅遊", "服務", "人物/事件"];

  const countries = useMemo(() => {
    const items = Array.from(new Set(posts.map((p) => p.country).filter(Boolean))) as string[];
    return ["全部", ...items];
  }, [posts]);

  const cities = useMemo(() => {
    const filtered = posts.filter((p) => {
      if (selectedCountry === "全部") return true;
      return p.country === selectedCountry;
    });

    const items = Array.from(new Set(filtered.map((p) => p.city).filter(Boolean))) as string[];
    return ["全部", ...items];
  }, [posts, selectedCountry]);

  const postsWithStats: RankedPost[] = useMemo(() => {
    return posts.map((post) => {
      const pitCount = votes.filter((vote) => vote.post_id === post.id).length;
      const commentCount = comments.filter((c) => c.post_id === post.id).length;
      const hotScore = getHotScore(post, pitCount, commentCount);
      const trendScore = getTrendScore(post, pitCount, commentCount);

      return {
        ...post,
        pitCount,
        commentCount,
        hotScore,
        trendScore,
      };
    });
  }, [posts, votes, comments]);

  const filteredPosts = useMemo(() => {
    return postsWithStats.filter((post) => {
      const matchCategory = selectedCategory === "全部" || post.category === selectedCategory;
      const matchCountry = selectedCountry === "全部" || post.country === selectedCountry;
      const matchCity = selectedCity === "全部" || post.city === selectedCity;

      return matchCategory && matchCountry && matchCity;
    });
  }, [postsWithStats, selectedCategory, selectedCountry, selectedCity]);

  const allTimeHot = [...filteredPosts]
    .sort((a, b) => b.pitCount - a.pitCount || b.hotScore - a.hotScore)
    .slice(0, 5);

  const latestPosts = [...filteredPosts]
    .sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    })
    .slice(0, 5);

  const mostDiscussed = [...filteredPosts]
    .sort((a, b) => b.commentCount - a.commentCount || b.hotScore - a.hotScore)
    .slice(0, 5);

  const trending = [...filteredPosts]
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-5 sm:py-6">
        <SiteHeader />

        <section className="mb-5 rounded-[32px] bg-gradient-to-br from-[#111827] via-[#0f172a] to-[#1e293b] px-6 py-8 text-white shadow-xl">
          <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs ring-1 ring-white/10">
            年輕人的反推薦平台
          </div>

          <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
            先冷靜，
            <br />
            再花錢。
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
            分享真實踩雷、避坑心得、雷店、雷商品、雷服務，也可以分享人物 / 事件警示。
            在花錢前，先看大家踩過哪些坑。
          </p>
        </section>

        <section className="mb-3">
          <div className="mb-2 text-xs font-semibold text-slate-500">類別</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setSelectedCategory(item)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm ${
                  selectedCategory === item
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-3">
          <div className="mb-2 text-xs font-semibold text-slate-500">國家</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {countries.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setSelectedCountry(item);
                  setSelectedCity("全部");
                }}
                className={`shrink-0 rounded-full px-4 py-2 text-sm ${
                  selectedCountry === item
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <div className="mb-2 text-xs font-semibold text-slate-500">城市</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {cities.map((item) => (
              <button
                key={item}
                onClick={() => setSelectedCity(item)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm ${
                  selectedCity === item
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-[32px] bg-slate-200/70 p-3 sm:p-4">
          <div className="mb-3 px-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">避坑排行榜</h2>
                <p className="text-xs text-slate-500">
                  目前篩選：{selectedCategory} / {selectedCountry} / {selectedCity}
                </p>
              </div>

              <div className="md:hidden rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                ← 左右滑動查看 →
              </div>
            </div>
          </div>

          <div className="md:hidden">
            <div className="-mx-1 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex snap-x snap-mandatory gap-3 px-1">
                <div className="min-w-[84%] snap-center">
                  <RankingBlock title="🔥 全站最坑" colorClass="text-rose-600" posts={allTimeHot} metricLabel="坑" />
                </div>

                <div className="min-w-[84%] snap-center">
                  <RankingBlock title="🆕 最新踩雷" colorClass="text-slate-900" posts={latestPosts} metricLabel="坑" />
                </div>

                <div className="min-w-[84%] snap-center">
                  <RankingBlock title="💬 討論最多" colorClass="text-sky-600" posts={mostDiscussed} metricLabel="留言" />
                </div>

                <div className="min-w-[84%] snap-center">
                  <RankingBlock title="⚡ 最近爆雷" colorClass="text-amber-600" posts={trending} metricLabel="熱度" />
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              <span className="h-2 w-2 rounded-full bg-slate-300" />
            </div>
          </div>

          <div className="hidden gap-4 md:grid md:grid-cols-2">
            <RankingBlock title="🔥 全站最坑" colorClass="text-rose-600" posts={allTimeHot} metricLabel="坑" />
            <RankingBlock title="🆕 最新踩雷" colorClass="text-slate-900" posts={latestPosts} metricLabel="坑" />
            <RankingBlock title="💬 討論最多" colorClass="text-sky-600" posts={mostDiscussed} metricLabel="留言" />
            <RankingBlock title="⚡ 最近爆雷" colorClass="text-amber-600" posts={trending} metricLabel="熱度" />
          </div>
        </section>

        <PostFeed posts={filteredPosts} />
      </div>
    </main>
  );
}