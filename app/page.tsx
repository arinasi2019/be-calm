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

function RankingBlock({
  title,
  colorClass,
  posts,
}: {
  title: string;
  colorClass: string;
  posts: Array<Post & { pitCount: number }>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className={`text-lg font-black ${colorClass}`}>{title}</h3>

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
              <div className="mt-2 inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                坑 {post.pitCount}
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

  const postsWithPit = posts.map((post) => {
    const pitCount = votes.filter((vote) => vote.post_id === post.id).length;
    return { ...post, pitCount };
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const todayHot = [...postsWithPit]
    .filter((post) => post.created_at && new Date(post.created_at) >= today)
    .sort((a, b) => b.pitCount - a.pitCount)
    .slice(0, 5);

  const weekHot = [...postsWithPit]
    .filter((post) => post.created_at && new Date(post.created_at) >= weekAgo)
    .sort((a, b) => b.pitCount - a.pitCount)
    .slice(0, 5);

  const latestPosts = [...postsWithPit].slice(0, 5);

  return (
    <main className="min-h-screen bg-[#fafafa] text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <header className="sticky top-0 z-20 mb-6 rounded-3xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/becalm-main-logo.png"
                alt="避坑 Be Calm"
                className="h-12 w-auto"
              />

              <div>
                <div className="text-lg font-black text-slate-900">
                  避坑 Be Calm
                </div>

                <div className="text-xs text-slate-500">
                  不種草，只避雷
                </div>
              </div>
            </div>

            <Link
              href="/write"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              發貼文
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
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
            title="🔥 最新踩雷"
            colorClass="text-slate-900"
            posts={latestPosts}
          />
        </section>

        <PostFeed posts={posts} />
      </div>
    </main>
  );
}