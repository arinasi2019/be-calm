import Link from "next/link";
import PostFeed from "./components/PostFeed";

type Post = {
  id: number;
  title: string;
  category: string;
  location: string;
  content: string;
  created_at: string | null;
  image_url?: string | null;
  video_url?: string | null;
  place_name?: string | null;
  google_maps_url?: string | null;
};

type Vote = {
  id: number;
  post_id: number;
};

const SUPABASE_URL = "https://hqnyqqmqpjmuyanmupxr.supabase.co";
const SUPABASE_KEY = "sb_publishable_IP_qqclWTJZfTeuTWNurTg_1Kbe6z9W";

async function getPosts(): Promise<Post[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?select=*&order=id.desc`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) return [];
  return res.json();
}

async function getVotes(): Promise<Vote[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/votes?select=id,post_id`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) return [];
  return res.json();
}

type RankedPost = Post & {
  pitCount: number;
  hotScore: number;
};

function getHoursAgo(dateString: string | null) {
  if (!dateString) return 999999;
  const created = new Date(dateString).getTime();
  const now = Date.now();
  return Math.max(1, (now - created) / (1000 * 60 * 60));
}

function getHotScore(post: Post, pitCount: number) {
  const hoursAgo = getHoursAgo(post.created_at);
  return pitCount * 1000 + 100 / Math.pow(hoursAgo + 2, 0.7);
}

function RankingBlock({
  title,
  colorClass,
  posts,
}: {
  title: string;
  colorClass: string;
  posts: RankedPost[];
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
              <div className="text-sm font-bold text-slate-900">
                #{index + 1} {post.title}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {post.place_name || post.location || post.category}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  坑 {post.pitCount}
                </span>

                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  熱度 {post.hotScore.toFixed(1)}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function HomePage() {
  const [posts, votes] = await Promise.all([getPosts(), getVotes()]);

  const postsWithStats: RankedPost[] = posts.map((post) => {
    const pitCount = votes.filter((vote) => vote.post_id === post.id).length;
    const hotScore = getHotScore(post, pitCount);
    return { ...post, pitCount, hotScore };
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const todayHot = [...postsWithStats]
    .filter((post) => post.created_at && new Date(post.created_at) >= startOfToday)
    .sort((a, b) => {
      if (b.pitCount !== a.pitCount) return b.pitCount - a.pitCount;
      return b.hotScore - a.hotScore;
    })
    .slice(0, 5);

  const weekHot = [...postsWithStats]
    .filter((post) => post.created_at && new Date(post.created_at) >= sevenDaysAgo)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 5);

  const allTimeHot = [...postsWithStats]
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 5);

  const latestPosts = [...postsWithStats].slice(0, 5);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-5 sm:py-6">
        <header className="sticky top-0 z-20 mb-5 rounded-[28px] border border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="/becalm-main-logo.png"
                alt="避坑 Be Calm"
                className="h-11 w-auto shrink-0 sm:h-12"
              />

              <div className="min-w-0">
                <div className="truncate text-lg font-black text-slate-900">
                  避坑 Be Calm
                </div>
                <div className="text-xs text-slate-500">不種草，只避雷</div>
              </div>
            </div>

            <Link
              href="/write"
              className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              發貼文
            </Link>
          </div>
        </header>

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
            分享真實踩雷、避坑心得、雷店、雷商品、雷服務。
            在花錢前，先看大家踩過哪些坑。
          </p>
        </section>

        <section className="mb-6 rounded-[32px] bg-slate-200/70 p-3 sm:p-4">
          <div className="mb-3 px-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">避坑排行榜</h2>
                <p className="text-xs text-slate-500">快速看最近最坑、最熱的內容</p>
              </div>

              <div className="md:hidden rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                ← 左右滑動查看 →
              </div>
            </div>
          </div>

          {/* 手機：slider */}
          <div className="md:hidden">
            <div className="-mx-1 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex snap-x snap-mandatory gap-3 px-1">
                <div className="min-w-[84%] snap-center">
                  <RankingBlock
                    title="🔥 今日最坑"
                    colorClass="text-rose-600"
                    posts={todayHot}
                  />
                </div>

                <div className="min-w-[84%] snap-center">
                  <RankingBlock
                    title="🔥 本週最坑"
                    colorClass="text-orange-600"
                    posts={weekHot}
                  />
                </div>

                <div className="min-w-[84%] snap-center">
                  <RankingBlock
                    title="🔥 全站最坑"
                    colorClass="text-fuchsia-600"
                    posts={allTimeHot}
                  />
                </div>

                <div className="min-w-[84%] snap-center">
                  <RankingBlock
                    title="🔥 最新踩雷"
                    colorClass="text-slate-900"
                    posts={latestPosts}
                  />
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

          {/* 桌機：2x2 */}
          <div className="hidden gap-4 md:grid md:grid-cols-2">
            <RankingBlock
              title="🔥 今日最坑"
              colorClass="text-rose-600"
              posts={todayHot}
            />

            <RankingBlock
              title="🔥 本週最坑"
              colorClass="text-orange-600"
              posts={weekHot}
            />

            <RankingBlock
              title="🔥 全站最坑"
              colorClass="text-fuchsia-600"
              posts={allTimeHot}
            />

            <RankingBlock
              title="🔥 最新踩雷"
              colorClass="text-slate-900"
              posts={latestPosts}
            />
          </div>
        </section>

        <PostFeed posts={posts} />
      </div>
    </main>
  );
}