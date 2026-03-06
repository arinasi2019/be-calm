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

export default async function HomePage() {
  const posts = await getPosts();

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

        <PostFeed posts={posts} />
      </div>
    </main>
  );
}