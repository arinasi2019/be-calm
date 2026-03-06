"use client";

import { useEffect, useMemo, useState } from "react";
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
  vote_type: "very_bad" | "neutral" | "not_bad";
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
  const date = new Date(dateString);
  return date.toLocaleString("zh-TW");
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

  const [veryBadCount, setVeryBadCount] = useState(0);
  const [neutralCount, setNeutralCount] = useState(0);
  const [notBadCount, setNotBadCount] = useState(0);

  useEffect(() => {
    setNickname(getAnonymousName());
    fetchComments();
    fetchVotes();
  }, [postId]);

  async function fetchComments() {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    setComments(data || []);
  }

  async function fetchVotes() {
    const { data } = await supabase
      .from("votes")
      .select("*")
      .eq("post_id", postId);

    const votes = (data || []) as Vote[];
    setVeryBadCount(votes.filter((v) => v.vote_type === "very_bad").length);
    setNeutralCount(votes.filter((v) => v.vote_type === "neutral").length);
    setNotBadCount(votes.filter((v) => v.vote_type === "not_bad").length);
  }

  async function handleVote(voteType: "very_bad" | "neutral" | "not_bad") {
    await supabase.from("votes").insert({
      post_id: postId,
      vote_type: voteType,
    });

    fetchVotes();
  }

  async function handleComment() {
    if (!commentText.trim()) return;

    setLoading(true);

    await supabase.from("comments").insert({
      post_id: postId,
      content: commentText,
      nickname,
    });

    setCommentText("");
    setLoading(false);
    fetchComments();
  }

  const totalVotes = useMemo(
    () => veryBadCount + neutralCount + notBadCount,
    [veryBadCount, neutralCount, notBadCount]
  );

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      {/* IG 風互動列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleVote("very_bad")}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:scale-105"
          >
            <span className="text-xl">😡</span>
            <span>{veryBadCount}</span>
          </button>

          <button
            onClick={() => handleVote("neutral")}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:scale-105"
          >
            <span className="text-xl">🤨</span>
            <span>{neutralCount}</span>
          </button>

          <button
            onClick={() => handleVote("not_bad")}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:scale-105"
          >
            <span className="text-xl">👍</span>
            <span>{notBadCount}</span>
          </button>
        </div>

        <div className="text-xs text-slate-400">共 {totalVotes} 票</div>
      </div>

      {/* 統計文字 */}
      <div className="mt-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{veryBadCount}</span> 人覺得很雷，
        <span className="ml-1 font-semibold text-slate-900">{comments.length}</span> 則留言
      </div>

      {/* 留言輸入 */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="mb-2 text-xs text-slate-500">
          目前身分：<span className="font-medium text-slate-700">{nickname}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="新增留言..."
            className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
          />

          <button
            onClick={handleComment}
            disabled={loading}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "送出中..." : "送出"}
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