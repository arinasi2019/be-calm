"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";

type ProfileRow = {
  id: string;
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type MyPost = {
  id: number;
  title: string;
  category: string;
  country?: string | null;
  city?: string | null;
  location?: string | null;
  place_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function getDisplayName(profile?: ProfileRow | null, fallbackEmail?: string | null) {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  if (profile?.username?.trim()) return profile.username.trim();
  if (profile?.email?.trim()) return profile.email.split("@")[0];
  if (fallbackEmail?.trim()) return fallbackEmail.split("@")[0];
  return "會員";
}

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return "未知時間";

  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "未知時間";

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [myPosts, setMyPosts] = useState<MyPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    const currentUserId = user.id;
    const currentUserEmail = user.email ?? null;

    async function loadProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUserId)
        .maybeSingle();

      if (!data) {
        const defaultRow: ProfileRow = {
          id: currentUserId,
          email: currentUserEmail,
        };

        await supabase.from("profiles").upsert(defaultRow);

        setProfile(defaultRow);
        return;
      }

      setProfile(data);
      setDisplayName(data.display_name || "");
      setUsername(data.username || "");
      setAvatarUrl(data.avatar_url || "");
    }

    async function loadMyPosts() {
      setPostsLoading(true);

      const { data } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      setMyPosts((data as MyPost[]) || []);
      setPostsLoading(false);
    }

    loadProfile();
    loadMyPosts();
  }, [user, loading, router]);

  async function handleUploadAvatar(file: File) {
    if (!user) return;

    setUploading(true);

    const path = `${user.id}/avatar.jpg`;

    await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
    });

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").upsert({
      id: user.id,
      avatar_url: publicUrl,
    });

    setAvatarUrl(publicUrl);
    setUploading(false);
  }

  async function handleSave() {
    if (!user) return;

    setSaving(true);

    await supabase.from("profiles").upsert({
      id: user.id,
      display_name: displayName,
      username,
      avatar_url: avatarUrl,
    });

    setSaving(false);
    alert("已更新");
  }

  async function handleDeletePost(postId: number) {
    if (!confirm("確定刪除？")) return;

    setDeletingPostId(postId);

    await supabase.from("posts").delete().eq("id", postId);

    setMyPosts((prev) => prev.filter((p) => p.id !== postId));
    setDeletingPostId(null);
  }

  if (loading || !user) return <div className="p-10">載入中...</div>;

  const name = getDisplayName(profile, user.email ?? null);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-5">

        {/* 個人資料 */}
        <section className="rounded-[28px] bg-white p-6 shadow">
          <h1 className="text-2xl font-bold mb-4">會員資料</h1>

          <div className="flex gap-4 items-center mb-4">
            {avatarUrl ? (
              <img src={avatarUrl} className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center">
                {name[0]}
              </div>
            )}

            <div>
              <div className="font-bold">{name}</div>
              <div className="text-sm text-gray-500">{user.email}</div>
            </div>
          </div>

          <input type="file" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadAvatar(file);
          }} />

          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="顯示名稱"
            className="block w-full mt-3 p-2 border"
          />

          <button
            onClick={handleSave}
            className="mt-3 bg-black text-white px-4 py-2 rounded"
          >
            {saving ? "儲存中..." : "儲存"}
          </button>
        </section>

        {/* 我的貼文 */}
        <section
          id="my-posts"
          className="rounded-[28px] bg-white p-6 shadow"
        >
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-bold">我的貼文</h2>
            <Link href="/write">＋發文</Link>
          </div>

          {postsLoading ? (
            <div>載入中...</div>
          ) : myPosts.length === 0 ? (
            <div className="text-gray-500">還沒有貼文</div>
          ) : (
            myPosts.map((post) => (
              <div key={post.id} className="border p-3 mb-2 rounded">
                <Link href={`/post/${post.id}`}>
                  {post.title}
                </Link>

                <div className="text-xs text-gray-500">
                  {formatDateTime(post.created_at)}
                </div>

                <div className="mt-2 flex gap-2">
                  <Link href={`/edit/${post.id}`} className="text-blue-500">
                    編輯
                  </Link>

                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-red-500"
                  >
                    {deletingPostId === post.id ? "刪除中..." : "刪除"}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

      </div>
    </main>
  );
}