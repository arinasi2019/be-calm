"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Comment = {
  id: number;
  content: string;
  created_at: string;
  post_id: number;
  nickname?: string | null;
};

type Vote = {
  id: number;
  post_id: number;
};

function getAnonymousName() {
  if (typeof window === "undefined") return "匿名用戶";
  const saved = localStorage.getItem("be-calm-nickname");
  if (saved) return saved;

  const random = Math.floor(100 + Math.random() * 900);
  const nickname = `匿名用戶 ${random}`;
  localStorage.setItem("be-calm-nickname", nickname);
  return nickname;
}

function formatCommentTime(dateString?: string) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("zh-TW");
}

function avatarText(name?: string | null) {
  if (!name) return "匿";
  return name.replace("匿名用戶 ", "").slice(0, 2) || "匿";
}

export default function PostActions({ postId }: { postId: number }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(false);
  const [nickname, setNickname] = useState("匿名用戶");
  const [pitCount, setPitCount] = useState(0);
  const [pitLoading, setPitLoading] = useState(false);
  const [hasPitted, setHasPitted] = useState(false);

  useEffect(() => {
    setNickname(getAnonymousName());
    fetchComments();
    fetchPits();

    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("be-calm-pitted-posts");
      if (raw) {
        try {
          const ids = JSON.parse(raw) as number[];
          setHasPitted(ids.includes(postId));
        } catch {
          setHasPitted(false);
        }
      }
    }
  }, [postId]);

  async function fetchComments() {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    setComments(data || []);
  }

  async function fetchPits() {
    const { data } = await supabase
      .from("votes")
      .select("id")
      .eq("post_id", postId);

    setPitCount((data || []).length);
  }

  async function handlePit() {
    if (hasPitted) return;

    setPitLoading(true);

    const { error } = await supabase.from("votes").insert({
      post_id: postId,
    });

    if (!error) {
      setPitCount((prev) => prev + 1);
      setHasPitted(true);

      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("be-calm-pitted-posts");
        let ids: number[] = [];

        if (raw) {
          try {
            ids = JSON.parse(raw);
          } catch {
            ids = [];
          }
        }

        const next = Array.from(new Set([...ids, postId]));
        localStorage.setItem("be-calm-pitted-posts", JSON.stringify(next));
      }
    }

    setPitLoading(false);
  }

  async function handleComment() {
    if (!commentText.trim()) return;

    setLoading(true);

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      content: commentText,
      nickname,
    });

    if (!error) {
      setCommentText("");
      fetchComments();
    }

    setLoading(false);
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      {/* 主互動列 */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePit}
          disabled={pitLoading || hasPitted}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            hasPitted
              ? "bg-rose-100 text-rose-700"
              : "bg-slate-900 text-white hover:opacity-90"
          }`}
        >
          {hasPitted ? "已踩坑" : pitLoading ? "送出中..." : "坑 +1"}
        </button>

        <div className="text-sm text-slate-500">
          已有 <span className="font-semibold text-slate-900">{pitCount}</span> 人踩坑
        </div>
      </div>

      {/* 留言區 */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="mb-2 text-xs text-slate-500">
          目前身分：<span className="font-medium text-slate-700">{nickname}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="補充你的踩雷經驗..."
            className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
          />

          <button
            onClick={handleComment}
            disabled={loading}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 ring-1 ring-slate-200 disabled:opacity-50"
          >
            {loading ? "送出中..." : "留言"}
          </button>
        </div>
      </div>

      {/* 留言列表 */}
      {comments.length > 0 && (
        <div className="mt-4 space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-3 rounded-2xl bg-slate-50 px-4 py-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 text-xs font-bold text-white">
                {avatarText(comment.nickname)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {comment.nickname || "匿名用戶"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatCommentTime(comment.created_at)}
                  </span>
                </div>

                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}