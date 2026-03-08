"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type CommentItem = {
  id: number;
  post_id: number;
  content: string;
  created_at: string | null;
  parent_id?: number | null;
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

  const [pitCount, setPitCount] = useState(0);
  const [hasPitted, setHasPitted] = useState(false);
  const [loadingPit, setLoadingPit] = useState(false);
  const [userVoteId, setUserVoteId] = useState<number | null>(null);

  const [threadOpen, setThreadOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyTextMap, setReplyTextMap] = useState<Record<number, string>>({});
  const [loadingReplyId, setLoadingReplyId] = useState<number | null>(null);

  const mainTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const storageKey = `be-calm-pitted-post-${postId}`;

  async function loadComments() {
    setLoadingComments(true);

    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, content, created_at, parent_id")
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
      setPitCount(((data ?? []) as VoteItem[]).length);
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
      parent_id: null,
    };

    setComments((prev) => [...prev, optimisticComment]);
    setCommentText("");
    setThreadOpen(true);

    const { data, error } = await supabase
      .from("comments")
      .insert([
        {
          post_id: postId,
          content,
          created_at: new Date().toISOString(),
          parent_id: null,
        },
      ])
      .select("id, post_id, content, created_at, parent_id")
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

  async function handleSubmitReply(parentId: number) {
    const content = (replyTextMap[parentId] || "").trim();
    if (!content || loadingReplyId === parentId) return;

    setLoadingReplyId(parentId);

    const optimisticReply: CommentItem = {
      id: Date.now(),
      post_id: postId,
      content,
      created_at: new Date().toISOString(),
      parent_id: parentId,
    };

    setComments((prev) => [...prev, optimisticReply]);
    setReplyTextMap((prev) => ({ ...prev, [parentId]: "" }));

    const { data, error } = await supabase
      .from("comments")
      .insert([
        {
          post_id: postId,
          content,
          created_at: new Date().toISOString(),
          parent_id: parentId,
        },
      ])
      .select("id, post_id, content, created_at, parent_id")
      .single();

    if (error) {
      setComments((prev) => prev.filter((item) => item.id !== optimisticReply.id));
      setReplyTextMap((prev) => ({ ...prev, [parentId]: content }));
      alert("回覆送出失敗：" + error.message);
      setLoadingReplyId(null);
      return;
    }

    setComments((prev) =>
      prev.map((item) => (item.id === optimisticReply.id ? (data as CommentItem) : item))
    );

    setLoadingReplyId(null);
  }

  function openCommentBox() {
    setThreadOpen(true);
    setTimeout(() => {
      mainTextareaRef.current?.focus();
    }, 0);
  }

  const topLevelComments = useMemo(
    () => comments.filter((c) => !c.parent_id),
    [comments]
  );

  const displayedTopLevelComments = useMemo(() => {
    if (threadOpen) return topLevelComments;
    return topLevelComments.slice(-2);
  }, [threadOpen, topLevelComments]);

  const repliesByParent = useMemo(() => {
    const map: Record<number, CommentItem[]> = {};
    for (const item of comments) {
      if (!item.parent_id) continue;
      if (!map[item.parent_id]) map[item.parent_id] = [];
      map[item.parent_id].push(item);
    }
    return map;
  }, [comments]);

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
          <span className={`transition-transform duration-150 ${hasPitted ? "scale-110" : ""}`}>
            坑
          </span>
          <span>{pitCount}</span>
        </button>

        <button
          type="button"
          onClick={openCommentBox}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 transition-all duration-150 active:scale-95 ${
            threadOpen
              ? "bg-sky-100 text-sky-700 ring-sky-200 shadow-sm"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:shadow-sm"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-[16px] w-[16px] transition-transform duration-150 ${
              threadOpen ? "scale-110" : ""
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

      <div className="mt-4 rounded-[24px] bg-slate-50/90 p-4 ring-1 ring-slate-200/80 backdrop-blur-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
            你
          </div>

          <div className="flex-1">
            <textarea
              ref={mainTextareaRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
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
        ) : displayedTopLevelComments.length === 0 ? (
          <div className="text-sm text-slate-400">還沒有留言，來留第一則吧。</div>
        ) : (
          <div className="space-y-3">
            {displayedTopLevelComments.map((comment) => {
              const replies = repliesByParent[comment.id] || [];
              const isReplying = replyingTo === comment.id;

              return (
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

                  <div className="mt-2 pl-11">
                    <button
                      type="button"
                      onClick={() =>
                        setReplyingTo((prev) => (prev === comment.id ? null : comment.id))
                      }
                      className="text-xs font-medium text-slate-500 hover:text-slate-900"
                    >
                      回覆
                    </button>
                  </div>

                  {replies.length > 0 && (
                    <div className="mt-3 space-y-2 pl-11">
                      {replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70"
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <div className="text-xs font-semibold text-slate-800">匿名用戶</div>
                            <div className="text-[11px] text-slate-400">
                              {formatRelativeTime(reply.created_at)}
                            </div>
                          </div>
                          <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {reply.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isReplying && (
                    <div className="mt-3 pl-11">
                      <textarea
                        value={replyTextMap[comment.id] || ""}
                        onChange={(e) =>
                          setReplyTextMap((prev) => ({
                            ...prev,
                            [comment.id]: e.target.value,
                          }))
                        }
                        placeholder="回覆這則留言..."
                        rows={2}
                        className="min-h-[48px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                      />

                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                        >
                          取消
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSubmitReply(comment.id)}
                          disabled={loadingReplyId === comment.id || !(replyTextMap[comment.id] || "").trim()}
                          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {loadingReplyId === comment.id ? "送出中..." : "送出回覆"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}