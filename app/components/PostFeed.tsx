"use client";

import PostActions from "./PostActions";

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
};

function formatDate(dateString: string | null) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("zh-TW");
}

export default function PostFeed({ posts }: { posts: Post[] }) {
  if (!posts || posts.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        目前還沒有貼文，來發第一篇吧。
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {posts.map((post, index) => (
        <article
          id={`post-${post.id}`}
          key={post.id}
          className={`scroll-mt-28 overflow-hidden rounded-[28px] border border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
            index % 2 === 0 ? "bg-white" : "bg-slate-50"
          }`}
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

            <div className="text-xs text-slate-400">⋯</div>
          </div>

          {/* 圖片 */}
          {post.image_url && (
            <img
              src={post.image_url}
              alt={post.title}
              className="w-full object-cover"
            />
          )}

          {/* 影片 */}
          {post.video_url && (
            <video
              src={post.video_url}
              controls
              className="w-full bg-black"
            />
          )}

          <div className="px-5 py-5">
            {/* tags */}
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                {post.category}
              </span>

              {post.location && (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
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
      ))}
    </section>
  );
}