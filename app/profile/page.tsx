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

function getDisplayName(profile?: ProfileRow | null, fallbackEmail?: string | null) {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  if (profile?.username?.trim()) return profile.username.trim();
  if (profile?.email?.trim()) return profile.email.split("@")[0];
  if (fallbackEmail?.trim()) return fallbackEmail.split("@")[0];
  return "會員";
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

    loadProfile();
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
        console.error("avatar upload error:", uploadError);
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
        console.error("profile avatar update error:", updateError);
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
      console.error("handleUploadAvatar unexpected error:", error);
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
      console.error("profile save error:", error);
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

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-xl rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          載入中...
        </div>
      </main>
    );
  }

  const currentName = getDisplayName(profile, user.email ?? null);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-xl space-y-5">
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

            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-slate-900 px-6 py-3 text-white disabled:opacity-50"
            >
              {saving ? "儲存中..." : "儲存資料"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}