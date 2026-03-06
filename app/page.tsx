import Link from "next/link";
import PostActions from "./components/PostActions";

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

function formatDate(dateString: string | null) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("zh-TW");
}

export default async function HomePage() {
  const posts = await getPosts();

  return (
    <main className="min-h-screen bg-[#fafafa] text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-6">

        {/* Header */}
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

        {/* Hero */}
        <section className="mb-6 rounded-3xl bg-gradient-to-br from-[#111827] via-[#0f172a] to-[#1e293b] px-6 py-8 text-white shadow-xl">

          <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs">
            年輕人的反推薦平台
          </div>

          <h1 className="mt-4 text-4xl font-black leading-tight">
            先冷靜，
            <br />
            再花錢。
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            分享真實踩雷、避坑心得、雷店、雷商品、雷服務。
            在花錢前，先看大家踩過哪些坑。
          </p>

        </section>

        {/* Feed */}
        <section className="space-y-6">

          {posts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              目前還沒有貼文，來發第一篇吧。
            </div>
          ) : (
            posts.map((post) => (
              <article
                key={post.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >

                {/* 作者列 */}
                <div className="flex items-center justify-between px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 via-orange-400 to-fuchsia-500 text-sm font-bold text-white">
                      坑
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {post.place_name || post.location || "匿名避坑人"}
                      </div>

                      <div className="text-xs text-slate-500">
                        {formatDate(post.created_at)}
                      </div>
                    </div>

                  </div>

                  <div className="text-xs text-slate-400">
                    ⋯
                  </div>

                </div>

                {/* 圖片 */}
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="w-full object-cover"
                  />
                )}

                <div className="px-5 py-5">

                  {/* tags */}
                  <div className="mb-3 flex flex-wrap gap-2">

                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      {post.category}
                    </span>

                    {post.location && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                        {post.location}
                      </span>
                    )}

                  </div>

                  <h2 className="text-2xl font-black text-slate-900">
                    {post.title}
                  </h2>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {post.content}
                  </p>

                  <PostActions postId={post.id} />

                </div>

              </article>
            ))
          )}

        </section>

      </div>
    </main>
  );
}