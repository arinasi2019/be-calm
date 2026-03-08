"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type CommentItem = {
  id: number;
  post_id: number;
  content: string;
  created_at: string | null;
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
  const [loading, setLoading] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [expanded, setExpanded] = useState(false);

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

  useEffect(() => {
    loadComments();
  }, [postId]);

  async function handleSubmitComment() {
    const content = commentText.trim();
    if (!content || loading) return;

    setLoading(true);

    const optimisticComment: CommentItem = {
      id: Date.now(),
      post_id: postId,
      content,
      created_at: new Date().toISOString(),
    };

    setComments((prev) => [...prev, optimisticComment]);
    setCommentText("");
    setExpanded(true);

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
      // rollback
      setComments((prev) => prev.filter((item) => item.id !== optimisticComment.id));
      alert("留言送出失敗：" + error.message);
      setCommentText(content);
      setLoading(false);
      return;
    }

    setComments((prev) =>
      prev.map((item) => (item.id === optimisticComment.id ? (data as CommentItem) : item))
    );

    setLoading(false);
  }

  const previewComments = useMemo(() => {
    if (expanded) return comments;
    return comments.slice(-2);
  }, [comments, expanded]);

  return (
    <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">
          留言 {comments.length > 0 ? `(${comments.length})` : ""}
        </div>

        {comments.length > 2 && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            {expanded ? "收起留言" : "查看全部"}
          </button>
        )}
      </div>

      <div className="mb-4 flex items-end gap-2">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="留下你的想法..."
          rows={1}
          className="min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400"
        />

        <button
          type="button"
          onClick={handleSubmitComment}
          disabled={loading || !commentText.trim()}
          className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "送出中" : "留言"}
        </button>
      </div>

      {loadingComments ? (
        <div className="text-sm text-slate-400">載入留言中...</div>
      ) : previewComments.length === 0 ? (
        <div className="text-sm text-slate-400">還沒有留言，來留第一則吧。</div>
      ) : (
        <div className="space-y-3">
          {previewComments.map((comment) => (
            <div key={comment.id} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">匿名用戶</div>
                <div className="text-xs text-slate-400">{formatRelativeTime(comment.created_at)}</div>
              </div>

              <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {comment.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}