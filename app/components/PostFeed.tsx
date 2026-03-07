"use client";

import { useEffect, useMemo, useState } from "react";
import PostActions from "./PostActions";
import BottomNav from "./BottomNav";

type MediaItem = {
  type: "image" | "video";
  url: string;
};

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
  external_url?: string | null;
  media_urls?: MediaItem[] | null;
};

type TabType = "home" | "search" | "saved";

function formatDate(dateString: string | null) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("zh-TW");
}

function getExternalLabel(post: Post) {
  if (post.category === "商品") return "🛒 商品連結";
  if (post.category === "旅遊") return "🗺 相關資訊";
  if (post.category === "服務") return "🔗 官方網站";
  return "🔗 相關連結";
}

function getMediaList(post: Post): MediaItem[] {
  if (post.media_urls && post.media_urls.length > 0) {
    return post.media_urls;
  }

  const fallback: MediaItem[] = [];

  if (post.image_url) {
    fallback.push({ type: "image", url: post.image_url });
  }

  if (post.video_url) {
    fallback.push({ type: "video", url: post.video_url });
  }

  return fallback;
}

function ShareButtons({ post }: { post: Post }) {
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/#post-${post.id}`
      : `#post-${post.id}`;

  const shareText = `${post.title}｜避坑 Be Calm`;

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareText,
          text: post.content.slice(0, 60),
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("連結已複製");
      }
    } catch {}
  }

  return (
    <div className="mt-4">
      <button
        onClick={handleShare}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
        >
          <path d="M12 16V4" />
          <path d="M8 8l4-4 4 4" />
          <path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2" />
        </svg>
        分享
      </button>
    </div>
  );
}

function MediaRail({
  post,
  onOpen,
}: {
  post: Post;
  onOpen: (media: MediaItem[], index: number) => void;
}) {
  const mediaList = getMediaList(post);

  if (mediaList.length === 0) return null;

  return (
    <div className="px-5 pt-2">
      <div className="overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid auto-cols-[calc(50%-0.25rem)] grid-flow-col gap-2">
          {mediaList.map((media, index) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-[18px]"
            >
              {media.type === "image" ? (
                <img
                  src={media.url}
                  className="h-44 w-full cursor-zoom-in object-cover"
                  onClick={() => onOpen(mediaList, index)}
                />
              ) : (
                <video
                  src={media.url}
                  controls
                  className="h-44 w-full bg-black object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Lightbox({
  media,
  index,
  setIndex,
  close,
}: {
  media: MediaItem[];
  index: number;
  setIndex: (n: number) => void;
  close: () => void;
}) {
  const current = media[index];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={close}
    >
      <div className="max-h-[80vh] max-w-[90vw]">
        {current.type === "image" ? (
          <img src={current.url} className="max-h-[80vh] rounded-xl" />
        ) : (
          <video src={current.url} controls className="max-h-[80vh]" />
        )}
      </div>
    </div>
  );
}

export default function PostFeed({ posts }: { posts: Post[] }) {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [lightboxMedia, setLightboxMedia] = useState<MediaItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [visible, setVisible] = useState(6);

  useEffect(() => {
    const raw = localStorage.getItem("be-calm-saved-posts");
    if (raw) setSavedIds(JSON.parse(raw));
  }, []);

  useEffect(() => {
    function handleScroll() {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 800
      ) {
        setVisible((v) => v + 4);
      }
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function toggleSave(id: number) {
    const next = savedIds.includes(id)
      ? savedIds.filter((x) => x !== id)
      : [...savedIds, id];

    setSavedIds(next);
    localStorage.setItem("be-calm-saved-posts", JSON.stringify(next));
  }

  const filtered = useMemo(() => {
    if (!query) return posts;

    return posts.filter(
      (p) =>
        p.title?.includes(query) ||
        p.content?.includes(query) ||
        p.location?.includes(query)
    );
  }, [posts, query]);

  const display = filtered.slice(0, visible);

  return (
    <>
      <section className="mb-24 space-y-5">
        {display.map((post, index) => {
          const saved = savedIds.includes(post.id);

          return (
            <article
              key={post.id}
              id={`post-${post.id}`}
              className="rounded-[28px] border bg-white shadow-sm"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-sm font-semibold">
                    {post.place_name || post.location}
                  </div>

                  <div className="text-xs text-slate-500">
                    {formatDate(post.created_at)}
                  </div>
                </div>

                <button
                  onClick={() => toggleSave(post.id)}
                  className="text-xs"
                >
                  {saved ? "已收藏" : "收藏"}
                </button>
              </div>

              <MediaRail
                post={post}
                onOpen={(media, i) => {
                  setLightboxMedia(media);
                  setLightboxIndex(i);
                }}
              />

              <div className="px-5 py-5">
                <h2 className="text-xl font-bold">{post.title}</h2>

                <p className="mt-2 text-sm text-slate-700">
                  {post.content}
                </p>

                <ShareButtons post={post} />

                <PostActions postId={post.id} />
              </div>
            </article>
          );
        })}
      </section>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />

      {lightboxMedia.length > 0 && (
        <Lightbox
          media={lightboxMedia}
          index={lightboxIndex}
          setIndex={setLightboxIndex}
          close={() => setLightboxMedia([])}
        />
      )}
    </>
  );
}