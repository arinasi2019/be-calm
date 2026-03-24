"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, PlusSquare, User } from "lucide-react";
import { useAuth } from "./AuthProvider";

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-30 mb-4">
      <div className="rounded-[22px] border border-slate-200 bg-white/88 px-3 py-2.5 shadow-sm backdrop-blur-md sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white">
                坑
              </div>

              <div className="min-w-0">
                <div className="truncate text-[15px] font-black leading-none text-slate-900 sm:text-base">
                  避坑 BeCalm
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  不種草，只避雷
                </div>
              </div>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isHome ? (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("becalm-open-search"))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="搜尋"
                title="搜尋"
              >
                <Search className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => router.push("/")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="回首頁"
                title="回首頁"
              >
                <Search className="h-4 w-4" />
              </button>
            )}

            <Link
              href="/write"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <PlusSquare className="h-4 w-4" />
              <span className="hidden sm:inline">發文</span>
            </Link>

            <Link
              href={user ? "/profile" : "/login"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              aria-label={user ? "個人頁" : "登入"}
              title={user ? "個人頁" : "登入"}
            >
              <User className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}