"use client";

type TabType = "home" | "search" | "saved";

export default function BottomNav({
  activeTab,
  onChange,
}: {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}) {
  const base =
    "flex-1 rounded-full px-4 py-3 text-sm font-medium transition";

  return (
    <div className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
      <div className="flex gap-2">
        <button
          onClick={() => onChange("home")}
          className={`${base} ${
            activeTab === "home"
              ? "bg-slate-900 text-white"
              : "bg-slate-50 text-slate-700"
          }`}
        >
          首頁
        </button>

        <button
          onClick={() => onChange("search")}
          className={`${base} ${
            activeTab === "search"
              ? "bg-slate-900 text-white"
              : "bg-slate-50 text-slate-700"
          }`}
        >
          搜尋
        </button>

        <button
          onClick={() => onChange("saved")}
          className={`${base} ${
            activeTab === "saved"
              ? "bg-slate-900 text-white"
              : "bg-slate-50 text-slate-700"
          }`}
        >
          收藏
        </button>
      </div>
    </div>
  );
}