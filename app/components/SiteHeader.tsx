"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, PenSquare, User } from "lucide-react";
import { supabase } from "../lib/supabase";

type ProfileRow = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    avatar_url?: string | null;
    picture?: string | null;
    full_name?: string | null;
    name?: string | null;
    user_name?: string | null;
  };
};

export default function SiteHeader() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadUserAndProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      setUser((user as AuthUser | null) ?? null);

      if (user?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;
        setProfile((data as ProfileRow | null) ?? null);
      } else {
        setProfile(null);
      }
    }

    loadUserAndProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = (session?.user as AuthUser | null) ?? null;
      setUser(nextUser);

      if (nextUser?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", nextUser.id)
          .maybeSingle();

        setProfile((data as ProfileRow | null) ?? null);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const avatarUrl = useMemo(() => {
    return (
      profile?.avatar_url ||
      user?.user_metadata?.avatar_url ||
      user?.user_metadata?.picture ||
      null
    );
  }, [profile, user]);

  const displayName = useMemo(() => {
    return (
      profile?.display_name ||
      profile?.username ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.user_metadata?.user_name ||
      user?.email ||
      "使用者"
    );
  }, [profile, user]);

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      setMenuOpen(false);
      router.refresh();
      router.push("/");
    } catch (error) {
      console.error("登出失敗:", error);
      alert("登出失敗，請再試一次");
    }
  }

  return (
    <header className="mb-6 px-4 pt-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-[32px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <Link href="/" className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
            <img
              src="/becalm-main-logo.png"
              alt="避坑 BeCalm"
              className="h-full w-full object-contain p-1"
            />
          </div>

          <div className="min-w-0">
            <div className="truncate text-2xl font-black text-[#0b1736] sm:text-3xl">
              避坑 BeCalm
            </div>
            <div className="truncate text-sm text-slate-500 sm:text-base">
              不種草，只避雷
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/write"
            className="hidden items-center gap-2 rounded-full bg-[#0b1736] px-4 py-2 text-sm font-bold text-white sm:inline-flex"
          >
            <PenSquare className="h-4 w-4" />
            發文
          </Link>

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-2"
                aria-label="開啟個人選單"
                aria-expanded={menuOpen}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                    <User className="h-5 w-5" />
                  </div>
                )}

                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="truncate text-sm font-bold text-slate-900">
                      {displayName}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {user.email || ""}
                    </div>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <User className="h-4 w-4" />
                    我的個人頁
                  </Link>

                  <Link
                    href="/write"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <PenSquare className="h-4 w-4" />
                    發表貼文
                  </Link>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    登出
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
            >
              登入
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}