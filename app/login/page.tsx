"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isRegister) {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/`
            : "https://becalm.social/";

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
          },
        });

        if (error) throw error;

        alert("註冊成功，請查看你的 Email 驗證信。驗證後可回到首頁登入。");
        router.push("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "發生錯誤");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-md">
        <div className="mb-5 flex justify-center">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/becalm-main-logo.png"
              alt="避坑 Be Calm"
              className="h-12 w-auto"
            />
            <div>
              <div className="text-lg font-black text-slate-900">避坑 Be Calm</div>
              <div className="text-xs text-slate-500">不種草，只避雷</div>
            </div>
          </Link>
        </div>

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="mb-5 text-center">
            <h1 className="text-2xl font-black text-slate-900">
              {isRegister ? "加入會員" : "會員登入"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              想發文、留言、回覆、收藏時，再登入就可以。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Email</label>
              <input
                type="email"
                placeholder="請輸入 Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">密碼</label>
              <input
                type="password"
                placeholder="請輸入密碼"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
              />
            </div>

            {error && (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-slate-900 px-6 py-3 text-white disabled:opacity-50"
            >
              {loading ? "處理中..." : isRegister ? "註冊" : "登入"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-slate-600">
            {isRegister ? "已經有帳號？" : "還沒有帳號？"}{" "}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="font-medium text-slate-900 underline"
            >
              {isRegister ? "改為登入" : "立即註冊"}
            </button>
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
            >
              先回首頁逛逛
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}