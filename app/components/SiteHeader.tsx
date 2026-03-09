"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

function getDisplayName(profile?: Profile | null, fallbackEmail?: string | null) {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  if (profile?.username?.trim()) return profile.username.trim();
  if (profile?.email?.trim()) return profile.email.split("@")[0];
  if (fallbackEmail?.trim()) return fallbackEmail.split("@")[0];
  return "會員";
}

export default function SiteHeader() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, email, username, display_name, avatar_url")
        .eq("id", user.id)
        .single();

      setProfile((data as Profile) || null);
    }

    loadProfile();
  }, [user]);

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  const displayName = getDisplayName(profile, user?.email ?? null);

  return (
    <header className="sticky top-0 z-20 mb-5 rounded-[28px] border border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
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
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/write"
            className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            發貼文
          </Link>

          {loading ? (
            <div className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-500">
              載入中...
            </div>
          ) : user ? (
            <>
              <Link
                href="/profile"
                className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700 sm:flex"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {displayName.slice(0, 1)}
                  </div>
                )}
                <span>{displayName}</span>
              </Link>

              <button
                onClick={handleSignOut}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
              >
                登出
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
            >
              登入
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}