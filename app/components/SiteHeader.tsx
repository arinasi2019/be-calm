"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, PenSquare, User, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";

type ProfileRow = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

export default function SiteHeader() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", user.id)
          .single();

        setProfile(data);
      }
    }

    loadUser();
  }, []);

  const avatarUrl = useMemo(() => {
    return profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  }, [profile, user]);

  const displayName = useMemo(() => {
    return (
      profile?.display_name ||
      profile?.username ||
      user?.email ||
      "使用者"
    );
  }, [profile, user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="mb-6">
      <div className="rounded-[32px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between">

          {/* 左側品牌 */}
          <Link href="/" className="flex items-center gap-4">

            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0b1736] text-3xl font-black text-white">
              坑
            </div>

            <div>
              <div className="text-2xl font-black text-slate-900">
                避坑 BeCalm
              </div>

              <div className="text-sm text-slate-500">
                不種草，只避雷
              </div>
            </div>

          </Link>

          {/* 右側 */}
          <div className="flex items-center gap-3">

            <Link
              href="/write"
              className="flex items-center gap-2 rounded-full bg-[#0b1736] px-4 py-2 text-sm font-bold text-white"
            >
              <PenSquare size={16} />
              發文
            </Link>

            {user ? (
              <div className="relative" ref={menuRef}>

                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-1"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200">
                      <User size={18} />
                    </div>
                  )}

                  <ChevronDown size={16} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-3 w-56 rounded-xl border bg-white shadow-lg">

                    <div className="border-b px-4 py-3 text-sm">
                      {displayName}
                    </div>

                    <Link
                      href="/profile"
                      className="block px-4 py-3 text-sm hover:bg-slate-50"
                    >
                      我的個人頁
                    </Link>

                    <Link
                      href="/write"
                      className="block px-4 py-3 text-sm hover:bg-slate-50"
                    >
                      發表貼文
                    </Link>

                    <button
                      onClick={handleSignOut}
                      className="block w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      登出
                    </button>

                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold"
              >
                登入
              </Link>
            )}

          </div>
        </div>
      </div>
    </header>
  );
}