"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type CommentItem = {
  id: number;
  post_id: number;
  content: string;
  created_at: string | null;
};

type VoteItem = {
  id: number;
  post_id: number;
};

function formatRelativeTime(dateString: string | null) {
  if (!dateString) return "剛剛";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "剛剛";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 1000 / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "剛剛";
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  if (diffHour < 24) return `${diffHour} 小時前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function PostActions({ postId }: { postId: number }) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComment, setLoadingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [showComposer, setShowComposer] = useState(false);

  const [pitCount, setPitCount] = useState(0);
  const [hasPitted, setHasPitted] = useState(false);
  const [loadingPit, setLoadingPit] = useState(false);
  const [userVoteId, setUserVoteId] = useState<number | null>(null);

  const storageKey = `be-calm-pitted-post-${postId}`;

  async function loadComments() {
    setLoadingComments(true);

    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, content, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!error) {
      setComments((data ?? []) as CommentItem[]);
    }

    setLoadingComments(false);
  }

  async function loadVotes() {
    const { data, error } = await supabase
      .from("votes")
      .select("id, post_id")
      .eq("post_id", postId);

    if (!error) {
      const voteRows = (data ?? []) as VoteItem[];
      setPitCount(voteRows.length);
    }
  }

  useEffect(() => {
    loadComments();
    loadVotes();

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setHasPitted(true);
          setUserVoteId(parsed.voteId ?? null);
        } catch {
          setHasPitted(false);
          setUserVoteId(null);
        }
      }
    }
  }, [postId]);

  async function handlePitToggle() {
    if (loadingPit) return;

    setLoadingPit(true);

    if (!hasPitted) {
      setPitCount((prev) => prev + 1);
      setHasPitted(true);

      const { data, error } = await supabase
        .from("votes")
        .insert([{ post_id: postId }])
        .select("id")
        .single();

      if (error) {
        setPitCount((prev) => Math.max(0, prev - 1));
        setHasPitted(false);
        alert("按坑失敗：" + error.message);
        setLoadingPit(false);
        return;
      }

      const voteId = data?.id ?? null;
      setUserVoteId(voteId);

      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, JSON.stringify({ voteId }));
      }

      setLoadingPit(false);
      return;
    }

    setPitCount((prev) => Math.max(0, prev - 1));
    setHasPitted(false);

    if (userVoteId) {
      const { error } = await supabase.from("votes").delete().eq("id", userVoteId);

      if (error) {
        setPitCount((prev) => prev + 1);
        setHasPitted(true);
        alert("取消坑失敗：" + error.message);
        setLoadingPit(false);
        return;
      }
    }

    setUserVoteId(null);

    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }

    setLoadingPit(false);
  }

  async function handleSubmitComment() {
    const content = commentText.trim();
    if (!content || loadingComment) return;

    setLoadingComment(true);

    const optimisticComment: CommentItem = {
      id: Date.now(),
      post_id: postId,
      content,
      created_at: new Date().toISOString(),
    };

    setComments((prev) => [...prev, optimisticComment]);
    setCommentText("");
    setShowComposer(true);

    const { data, error } = await supabase
      .from("comments")
      .insert([
        {
          post_id: postId,
          content,
          created_at: new Date().toISOString(),
        },
      ])
      .select("id, post_id, content, created_at")
      .single();

    if (error) {
      setComments((prev) => prev.filter((item) => item.id !== optimisticComment.id));
      alert("留言送出失敗：" + error.message);
      setCommentText(content);
      setLoadingComment(false);
      return;
    }

    setComments((prev) =>
      prev.map((item) => (item.id === optimisticComment.id ? (data as CommentItem) : item))
    );

    setLoadingComment(false);
  }

  function handleCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  }

  const previewComments = useMemo(() => comments.slice(-2), [comments]);

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={handlePitToggle}
          disabled={loadingPit}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 transition-all duration-150 active:scale-95 ${
            hasPitted
              ? "bg-rose-100 text-rose-700 ring-rose-200 shadow-sm"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:shadow-sm"
          } disabled:opacity-70`}
        >
          <span
            className={`inline-block transition-transform duration-150 ${
              hasPitted ? "scale-110" : "scale-100"
            }`}
          >
            坑
          </span>
          <span>{pitCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowComposer((prev) => !prev)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 transition-all duration-150 active:scale-95 ${
            showComposer
              ? "bg-sky-100 text-sky-700 ring-sky-200 shadow-sm"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:shadow-sm"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-[16px] w-[16px] transition-transform duration-150 ${
              showComposer ? "scale-110" : "scale-100"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>留言</span>
          <span>{comments.length}</span>
        </button>
      </div>

      {(showComposer || comments.length > 0) && (
        <div className="mt-4 rounded-[24px] bg-slate-50/90 p-4 ring-1 ring-slate-200/80 backdrop-blur-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
              你
            </div>

            <div className="flex-1">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={handleCommentKeyDown}
                placeholder="寫下你的留言..."
                rows={2}
                className="min-h-[52px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400"
              />

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={loadingComment || !commentText.trim()}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-95 disabled:opacity-50"
                >
                  {loadingComment ? "送出中..." : "留言"}
                </button>
              </div>
            </div>
          </div>

          {loadingComments ? (
            <div className="text-sm text-slate-400">載入留言中...</div>
          ) : previewComments.length === 0 ? (
            <div className="text-sm text-slate-400">還沒有留言，來留第一則吧。</div>
          ) : (
            <div className="space-y-3">
              {previewComments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                      匿
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">匿名用戶</div>
                      <div className="text-xs text-slate-400">
                        {formatRelativeTime(comment.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap pl-11 text-sm leading-6 text-slate-700">
                    {comment.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}