"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, PenSquare, User, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";

type ProfileRow = {
  id: string;
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    avatar_url?: string | null;
    full_name?: string | null;
    name?: string | null;
    user_name?: string | null;
  };
};

export default function SiteHeader() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      setUser((user as AuthUser | null) ?? null);

      if (user?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("id, email, username, display_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;
        setProfile((data as ProfileRow | null) ?? null);
      } else {
        setProfile(null);
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = (session?.user as AuthUser | null) ?? null;
      setUser(nextUser);

      if (nextUser?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("id, email, username, display_name, avatar_url")
          .eq("id", nextUser.id)
          .maybeSingle();

        setProfile((data as ProfileRow | null) ?? null);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
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
    return profile?.avatar_url || user?.user_metadata?.avatar_url || null;
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.refresh();
    router.push("/");
  };

  return (
    <header className="mb-6">
      <div className="rounded-[32px] border border-slate-200 bg-white/95 px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-md sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="min-w-0 flex items-center gap-4 transition hover:opacity-90"
          >
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#0b1736] text-4xl font-black text-white shadow-sm sm:h-24 sm:w-24 sm:text-5xl">
              坑
            </div>

            <div className="min-w-0">
              <div className="truncate text-3xl font-black leading-none text-slate-900 sm:text-5xl">
                避坑 BeCalm
              </div>
              <div className="mt-2 truncate text-lg font-medium text-slate-500 sm:text-2xl">
                不種草，只避雷
              </div>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/write"
              className="hidden items-center gap-2 rounded-full bg-[#0b1736] px-6 py-4 text-base font-bold text-white transition hover:bg-[#13214a] sm:inline-flex"
            >
              <PenSquare className="h-5 w-5" />
              發文
            </Link>

            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full transition"
                  aria-label="開啟個人選單"
                  aria-expanded={menuOpen}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-100 sm:h-24 sm:w-24"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-2 ring-slate-100 sm:h-24 sm:w-24">
                      <User className="h-9 w-9 sm:h-10 sm:w-10" />
                    </div>
                  )}

                  <ChevronDown
                    className={`hidden h-5 w-5 text-slate-500 transition sm:block ${
                      menuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-[92px] z-50 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.16)] sm:top-[108px]">
                    <div className="border-b border-slate-100 px-4 py-4">
                      <div className="flex items-center gap-3">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                            <User className="h-6 w-6" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-900">
                            {displayName}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {user.email || "已登入使用者"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      <Link
                        href="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                      >
                        <User className="h-4 w-4" />
                        我的個人頁
                      </Link>

                      <Link
                        href="/write"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                      >
                        <PenSquare className="h-4 w-4" />
                        發表貼文
                      </Link>

                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        <LogOut className="h-4 w-4" />
                        登出
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="flex h-12 items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-200 sm:h-14"
                >
                  登入
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 sm:hidden">
          <Link
            href="/write"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0b1736] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#13214a]"
          >
            <PenSquare className="h-4 w-4" />
            發文
          </Link>
        </div>
      </div>
    </header>
  );
}