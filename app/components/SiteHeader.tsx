"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { ChevronDown } from "lucide-react";

export default function SiteHeader() {
  const { user } = useAuth();

  const avatar =
    user?.user_metadata?.avatar_url ||
    "https://ui-avatars.com/api/?name=User&background=0D1B2A&color=fff";

  return (
    <header className="px-4 pt-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-3xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">

        {/* 左邊 LOGO */}
        <Link href="/" className="flex items-center gap-4">

          <img
            src="/becalm-main-logo.png"
            alt="避坑 BeCalm"
            className="h-16 w-16 rounded-full object-contain"
          />

          <div className="leading-tight">
            <div className="text-2xl font-black text-[#0b1736]">
              避坑 BeCalm
            </div>

            <div className="text-sm text-slate-500">
              不種草，只避雷
            </div>
          </div>

        </Link>

        {/* 右邊頭像 */}
        <div className="flex items-center gap-2">

          <img
            src={avatar}
            alt="avatar"
            className="h-10 w-10 rounded-full object-cover"
          />

          <ChevronDown className="h-4 w-4 text-slate-500" />

        </div>

      </div>
    </header>
  );
}