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
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, username, display_name, avatar_url")
        .eq("id", currentUserId)
        .maybeSingle();

      if (error) {
        console.error("load profile error:", error);
        return;
      }

      if (!data) {
        const defaultRow: ProfileRow = {
          id: currentUserId,
          email: currentUserEmail,
          username: null,
          display_name: null,
          avatar_url: null,
        };

        const { error: upsertError } = await supabase.from("profiles").upsert(defaultRow);

        if (upsertError) {
          console.error("create default profile error:", upsertError);
          return;
        }

        setProfile(defaultRow);
        setDisplayName("");
        setUsername("");
        setAvatarUrl("");
        return;
      }

      const row = data as ProfileRow;
      setProfile(row);
      setDisplayName(row.display_name || "");
      setUsername(row.username || "");
      setAvatarUrl(row.avatar_url || "");
    }

    async function loadMyPosts() {
      setPostsLoading(true);

      const { data, error } = await supabase
        .from("posts")
        .select("id, title, category, country, city, location, place_name, created_at, updated_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("load my posts error:", error);
        setMyPosts([]);
        setPostsLoading(false);
        return;
      }

      setMyPosts((data as MyPost[]) || []);
      setPostsLoading(false);
    }

    loadProfile();
    loadMyPosts();
  }, [user, loading, router]);

  async function handleUploadAvatar(file: File) {
    if (!user) return;

    if (!file.type.startsWith("image/")) {
      alert("請上傳圖片檔");
      return;
    }

    setUploading(true);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        alert("頭像上傳失敗：" + uploadError.message);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email ?? null,
        avatar_url: publicUrl,
        display_name: displayName.trim() || null,
        username: username.trim() || null,
      });

      if (updateError) {
        alert("更新頭像失敗：" + updateError.message);
        setUploading(false);
        return;
      }

      setAvatarUrl(publicUrl);
      setProfile((prev) =>
        prev
          ? { ...prev, avatar_url: publicUrl }
          : {
              id: user.id,
              email: user.email ?? null,
              display_name: displayName.trim() || null,
              username: username.trim() || null,
              avatar_url: publicUrl,
            }
      );

      setUploading(false);
      router.refresh();
      alert("頭像已更新");
    } catch (error: any) {
      setUploading(false);
      alert("頭像上傳失敗：" + (error?.message || "未知錯誤"));
    }
  }

  async function handleSave() {
    if (!user) return;

    setSaving(true);

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email ?? null,
      display_name: displayName.trim() || null,
      username: username.trim() || null,
      avatar_url: avatarUrl || null,
    });

    setSaving(false);

    if (error) {
      alert("儲存失敗：" + error.message);
      return;
    }

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            email: user.email ?? null,
            display_name: displayName.trim() || null,
            username: username.trim() || null,
            avatar_url: avatarUrl || null,
          }
        : {
            id: user.id,
            email: user.email ?? null,
            display_name: displayName.trim() || null,
            username: username.trim() || null,
            avatar_url: avatarUrl || null,
          }
    );

    router.refresh();
    alert("會員資料已更新");
  }

  async function handleDeletePost(postId: number) {
    if (!user) return;

    const confirmed = window.confirm("確定要刪除這篇貼文嗎？刪除後無法恢復。");
    if (!confirmed) return;

    setDeletingPostId(postId);

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", user.id);

    setDeletingPostId(null);

    if (error) {
      alert("刪除失敗：" + error.message);
      return;
    }

    setMyPosts((prev) => prev.filter((post) => post.id !== postId));
    alert("貼文已刪除");
    router.refresh();
  }

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          載入中...
        </div>
      </main>
    );
  }

  const currentName = getDisplayName(profile, user.email ?? null);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black">會員資料</h1>
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
            >
              回首頁
            </Link>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="mb-6 flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={currentName}
                className="h-20 w-20 rounded-full object-cover ring-1 ring-slate-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 text-2xl font-bold text-white">
                {currentName.slice(0, 1)}
              </div>
            )}

            <div>
              <div className="text-lg font-bold">{currentName}</div>
              <div className="text-sm text-slate-500">{user.email}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">上傳頭像</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadAvatar(file);
                }}
                className="block w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
              {uploading && (
                <p className="mt-2 text-sm text-slate-500">頭像上傳中...</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">顯示名稱</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例如：Liang / 小梁 / TokyoFoodHunter"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例如：liang123"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Email</label>
              <input
                type="text"
                value={user.email || ""}
                disabled
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500 outline-none"
              />
              <p className="mt-2 text-xs text-slate-400">
                目前這裡先顯示登入 email，如要支援修改登入 email，需要另外串接帳號設定流程。
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-slate-900 px-6 py-3 text-white disabled:opacity-50"
            >
              {saving ? "儲存中..." : "儲存資料"}
            </button>
          </div>
        </section>

        <section
          id="my-posts"
          className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">我的貼文</h2>
            <Link
              href="/write"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
            >
              ＋ 發新貼文
            </Link>
          </div>

          {postsLoading ? (
            <div className="text-sm text-slate-500">載入中...</div>
          ) : myPosts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              你目前還沒有發過貼文。
            </div>
          ) : (
            <div className="space-y-3">
              {myPosts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/post/${post.id}`}
                        className="block text-base font-bold text-slate-900 hover:text-slate-700"
                      >
                        {post.place_name || post.title}
                      </Link>

                      {post.place_name && post.title && post.place_name !== post.title && (
                        <div className="mt-1 text-sm text-slate-700">{post.title}</div>
                      )}

                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{post.category}</span>
                        {post.country && <span>{post.country}</span>}
                        {post.city && <span>{post.city}</span>}
                        {post.location && <span>{post.location}</span>}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                        <span>發佈：{formatDateTime(post.created_at)}</span>
                        {post.updated_at && <span>更新：{formatDateTime(post.updated_at)}</span>}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Link
                        href={`/edit/${post.id}`}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
                      >
                        編輯
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletingPostId === post.id}
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 disabled:opacity-60"
                      >
                        {deletingPostId === post.id ? "刪除中..." : "刪除"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}