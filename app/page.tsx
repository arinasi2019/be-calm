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

type FeedMode = "推薦" | "最新" | "最熱" | "爆雷中";

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

function formatPostMeta(post: RankedPost) {
  return [post.category, post.country, post.city].filter(Boolean).join("・");
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
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-black ${colorClass}`}>{title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
          Top 5
        </span>
      </div>

      {posts.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">目前沒有資料</p>
      ) : (
        <div className="mt-3 space-y-3">
          {posts.map((post, index) => (
            <a
              key={post.id}
              href={`/post/${post.id}`}
              className="block rounded-2xl border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200 hover:bg-slate-100"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-bold leading-5 text-slate-900">
                    {post.title}
                  </div>

                  <div className="mt-1 line-clamp-1 text-xs text-slate-500">
                    {formatPostMeta(post)}
                    {post.incident_type ? `・${post.incident_type}` : ""}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {metricLabel === "坑" && (
                      <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                        坑 {post.pitCount}
                      </span>
                    )}

                    {metricLabel === "留言" && (
                      <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                        留言 {post.commentCount}
                      </span>
                    )}

                    {metricLabel === "熱度" && (
                      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        熱度 {post.trendScore.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniFeedCard({
  title,
  subtitle,
  value,
}: {
  title: string;
  subtitle: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
      <div className="text-[11px] font-semibold tracking-wide text-slate-300 uppercase">
        {title}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
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
  const [feedMode, setFeedMode] = useState<FeedMode>("推薦");

  useEffect(() => {
    async function load() {
      const [postsRes, votesRes, commentsRes] = await Promise.all([
        supabase.from("posts").select("*").order("id", { ascending: false }),
        supabase.from("votes").select("id, post_id"),
        supabase.from("comments").select("id, post_id"),
      ]);

      const rawPosts = (postsRes.data as Post[]) || [];
      const userIds = Array.from(
        new Set(rawPosts.map((post) => post.user_id).filter(Boolean) as string[])
      );

      const profileMap: Record<string, Profile> = {};

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

  const allTimeHot = useMemo(
    () =>
      [...filteredPosts]
        .sort((a, b) => b.pitCount - a.pitCount || b.hotScore - a.hotScore)
        .slice(0, 5),
    [filteredPosts]
  );

  const latestPosts = useMemo(
    () =>
      [...filteredPosts]
        .sort((a, b) => {
          const at = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bt - at;
        })
        .slice(0, 5),
    [filteredPosts]
  );

  const mostDiscussed = useMemo(
    () =>
      [...filteredPosts]
        .sort((a, b) => b.commentCount - a.commentCount || b.hotScore - a.hotScore)
        .slice(0, 5),
    [filteredPosts]
  );

  const trending = useMemo(
    () => [...filteredPosts].sort((a, b) => b.trendScore - a.trendScore).slice(0, 5),
    [filteredPosts]
  );

  const displayPosts = useMemo(() => {
    const sorted = [...filteredPosts];

    if (feedMode === "最新") {
      return sorted.sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      });
    }

    if (feedMode === "最熱") {
      return sorted.sort((a, b) => b.hotScore - a.hotScore);
    }

    if (feedMode === "爆雷中") {
      return sorted.sort((a, b) => b.trendScore - a.trendScore);
    }

    return sorted.sort((a, b) => {
      const scoreA = a.hotScore * 0.55 + a.trendScore * 0.45;
      const scoreB = b.hotScore * 0.55 + b.trendScore * 0.45;
      return scoreB - scoreA;
    });
  }, [filteredPosts, feedMode]);

  const totalPitCount = useMemo(
    () => filteredPosts.reduce((sum, post) => sum + post.pitCount, 0),
    [filteredPosts]
  );

  const totalCommentCount = useMemo(
    () => filteredPosts.reduce((sum, post) => sum + post.commentCount, 0),
    [filteredPosts]
  );

  const filterSummary = [selectedCategory, selectedCountry, selectedCity].join(" / ");

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-5 sm:py-6">
        <SiteHeader />

        <section className="mb-5 overflow-hidden rounded-[30px] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#1e293b] text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
          <div className="px-5 py-6 sm:px-7 sm:py-7">
            <div className="flex flex-col gap-5">
              <div className="max-w-2xl">
                <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">
                  不種草，只避雷
                </div>

                <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
                  今天又有誰，
                  <br className="hidden sm:block" />
                  出來爆雷了？
                </h1>

                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                  看大家最近在吵什麼、踩了哪些坑、哪些店被狂刷坑+1。
                  BeCalm 首頁不只是搜尋，而是直接刷最新避坑動態。
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MiniFeedCard
                  title="目前貼文"
                  value={filteredPosts.length.toString()}
                  subtitle="符合目前篩選條件"
                />
                <MiniFeedCard
                  title="總坑數"
                  value={totalPitCount.toString()}
                  subtitle="大家一起踩過的坑"
                />
                <MiniFeedCard
                  title="總留言"
                  value={totalCommentCount.toString()}
                  subtitle="正在發酵的討論"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/10 px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(["推薦", "最新", "最熱", "爆雷中"] as FeedMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFeedMode(mode)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      feedMode === mode
                        ? "bg-white text-slate-900"
                        : "bg-white/8 text-slate-200 ring-1 ring-white/10 hover:bg-white/12"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-300">
                正在查看：<span className="font-bold text-white">{feedMode}</span> ・ {filterSummary}
              </div>
            </div>
          </div>
        </section>

        <section className="sticky top-[60px] z-20 mb-4 rounded-[24px] border border-slate-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-md">
          <div className="space-y-2">
            <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="shrink-0 text-[11px] font-bold text-slate-400">類別</span>
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => setSelectedCategory(item)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selectedCategory === item
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="shrink-0 text-[11px] font-bold text-slate-400">地區</span>
              {countries.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setSelectedCountry(item);
                    setSelectedCity("全部");
                  }}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selectedCountry === item
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            {cities.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className="shrink-0 text-[11px] font-bold text-slate-400">城市</span>
                {cities.map((item) => (
                  <button
                    key={item}
                    onClick={() => setSelectedCity(item)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedCity === item
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-[26px] border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">避坑排行榜</h3>
                <p className="text-xs text-slate-500">更像 app，一樣可以快速刷熱門</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                左右滑動
              </span>
            </div>

            <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-3 px-1">
                <div className="w-[280px] shrink-0">
                  <RankingBlock title="🔥 全站最坑" colorClass="text-rose-600" posts={allTimeHot} metricLabel="坑" />
                </div>
                <div className="w-[280px] shrink-0">
                  <RankingBlock title="💬 討論最多" colorClass="text-sky-600" posts={mostDiscussed} metricLabel="留言" />
                </div>
                <div className="w-[280px] shrink-0">
                  <RankingBlock title="⚡ 最近爆雷" colorClass="text-amber-600" posts={trending} metricLabel="熱度" />
                </div>
                <div className="w-[280px] shrink-0">
                  <RankingBlock title="🆕 最新踩雷" colorClass="text-slate-900" posts={latestPosts} metricLabel="坑" />
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                  {feedMode}動態
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  先刷內容，再決定要不要點進去。
                </p>
              </div>

              <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                共 {displayPosts.length} 篇
              </div>
            </div>

            <PostFeed posts={displayPosts} />
          </section>
        </div>
      </div>
    </main>
  );
}