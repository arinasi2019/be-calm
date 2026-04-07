"use client";

import { Heart, Home, Search } from "lucide-react";

type TabType = "home" | "search" | "saved";

export default function BottomNav({
  activeTab,
  onChange,
}: {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}) {
  const itemBase =
    "flex flex-1 flex-col items-center justify-center rounded-2xl px-3 py-2 text-[11px] font-medium transition";

  return (
    <div className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-[28px] border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange("home")}
          className={`${itemBase} ${
            activeTab === "home"
              ? "bg-slate-900 text-white"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Home className="mb-1 h-4 w-4" />
          首頁
        </button>

        <button
          type="button"
          onClick={() => onChange("search")}
          className={`${itemBase} ${
            activeTab === "search"
              ? "bg-slate-900 text-white"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Search className="mb-1 h-4 w-4" />
          搜尋
        </button>

        <button
          type="button"
          onClick={() => onChange("saved")}
          className={`${itemBase} ${
            activeTab === "saved"
              ? "bg-slate-900 text-white"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Heart className="mb-1 h-4 w-4" />
          收藏
        </button>
      </div>
    </div>
  );
}