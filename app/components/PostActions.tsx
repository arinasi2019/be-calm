"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type CommentItem = {
  id: number;
  post_id: number;
  content: string;
  created_at: string | null;
  parent_id?: number | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
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

async function uploadCommentMedia(file: File) {
  const ext = file.name.split(".").pop() || "bin";
  const folder = file.type.startsWith("video/") ? "comment-videos" : "comment-images";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from("media").upload(path, file);

  if (error) throw error;

  const { data } = supabase.storage.from("media").getPublicUrl(path);

  return {
    media_url: data.publicUrl,
    media_type: file.type.startsWith("video/") ? "video" as const : "image" as const,
  };
}

function MediaPreview({
  url,
  type,
}: {
  url: string;
  type: "image" | "video";
}) {
  if (type === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="mt-3 max-h-72 w-full rounded-2xl bg-black object-cover"
      />
    );
  }

  return (
    <img
      src={url}
      alt="comment-media"
      className="mt-3 max-h-72 w-full rounded-2xl object-cover"
    />
  );
}

export default function PostActions({ postId }: { postId: number }) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [loadingComment, setLoadingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);

  const [pitCount, setPitCount] = useState(0);
  const [hasPitted, setHasPitted] = useState(false);
  const [loadingPit, setLoadingPit] = useState(false);
  const [userVoteId, setUserVoteId] = useState<number | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyTextMap, setReplyTextMap] = useState<Record<number, string>>({});
  const [replyFileMap, setReplyFileMap] = useState<Record<number, File | null>>({});
  const [loadingReplyId, setLoadingReplyId] = useState<number | null>(null);

  const storageKey = `be-calm-pitted-post-${postId}`;

  async function loadComments() {
    setLoadingComments(true);

    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, content, created_at, parent_id, media_url, media_type")
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

  useEffect(() => {
    if (!sheetOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

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
    if ((!content && !commentFile) || loadingComment) return;

    setLoadingComment(true);

    let uploadedMedia: { media_url: string | null; media_type: "image" | "video" | null } = {
      media_url: null,
      media_type: null,
    };

    try {
      if (commentFile) {
        uploadedMedia = await uploadCommentMedia(commentFile);
      }

      const optimisticComment: CommentItem = {
        id: Date.now(),
        post_id: postId,
        content,
        created_at: new Date().toISOString(),
        parent_id: null,
        media_url: uploadedMedia.media_url,
        media_type: uploadedMedia.media_type,
      };

      setComments((prev) => [...prev, optimisticComment]);
      setCommentText("");
      setCommentFile(null);

      const { data, error } = await supabase
        .from("comments")
        .insert([
          {
            post_id: postId,
            content,
            created_at: new Date().toISOString(),
            parent_id: null,
            media_url: uploadedMedia.media_url,
            media_type: uploadedMedia.media_type,
          },
        ])
        .select("id, post_id, content, created_at, parent_id, media_url, media_type")
        .single();

      if (error) {
        setComments((prev) => prev.filter((item) => item.id !== optimisticComment.id));
        setCommentText(content);
        alert("留言送出失敗：" + error.message);
        setLoadingComment(false);
        return;
      }

      setComments((prev) =>
        prev.map((item) => (item.id === optimisticComment.id ? (data as CommentItem) : item))
      );
    } catch (e: any) {
      alert("媒體上傳失敗：" + e.message);
    }

    setLoadingComment(false);
  }

  async function handleSubmitReply(parentId: number) {
    const content = (replyTextMap[parentId] || "").trim();
    const file = replyFileMap[parentId] || null;

    if ((!content && !file) || loadingReplyId === parentId) return;

    setLoadingReplyId(parentId);

    let uploadedMedia: { media_url: string | null; media_type: "image" | "video" | null } = {
      media_url: null,
      media_type: null,
    };

    try {
      if (file) {
        uploadedMedia = await uploadCommentMedia(file);
      }

      const optimisticReply: CommentItem = {
        id: Date.now(),
        post_id: postId,
        content,
        created_at: new Date().toISOString(),
        parent_id: parentId,
        media_url: uploadedMedia.media_url,
        media_type: uploadedMedia.media_type,
      };

      setComments((prev) => [...prev, optimisticReply]);
      setReplyTextMap((prev) => ({ ...prev, [parentId]: "" }));
      setReplyFileMap((prev) => ({ ...prev, [parentId]: null }));

      const { data, error } = await supabase
        .from("comments")
        .insert([
          {
            post_id: postId,
            content,
            created_at: new Date().toISOString(),
            parent_id: parentId,
            media_url: uploadedMedia.media_url,
            media_type: uploadedMedia.media_type,
          },
        ])
        .select("id, post_id, content, created_at, parent_id, media_url, media_type")
        .single();

      if (error) {
        setComments((prev) => prev.filter((item) => item.id !== optimisticReply.id));
        setReplyTextMap((prev) => ({ ...prev, [parentId]: content }));
        setReplyFileMap((prev) => ({ ...prev, [parentId]: file }));
        alert("回覆送出失敗：" + error.message);
        setLoadingReplyId(null);
        return;
      }

      setComments((prev) =>
        prev.map((item) => (item.id === optimisticReply.id ? (data as CommentItem) : item))
      );
    } catch (e: any) {
      alert("媒體上傳失敗：" + e.message);
    }

    setLoadingReplyId(null);
  }

  const topLevelComments = useMemo(
    () => comments.filter((c) => !c.parent_id),
    [comments]
  );

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
          onClick={() => setSheetOpen(true)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 transition-all duration-150 active:scale-95 ${
            sheetOpen
              ? "bg-sky-100 text-sky-700 ring-sky-200 shadow-sm"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:shadow-sm"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-[16px] w-[16px] transition-transform duration-150 ${
              sheetOpen ? "scale-110" : ""
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

      {sheetOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={() => setSheetOpen(false)}
          />

          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl">
            <div className="max-h-[84vh] overflow-hidden rounded-t-[32px] border border-slate-200/70 bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.22)]">
              <div className="sticky top-0 z-10 rounded-t-[32px] border-b border-slate-100 bg-white/95 backdrop-blur">
                <div className="flex justify-center pt-3">
                  <div className="h-1.5 w-12 rounded-full bg-slate-300/90" />
                </div>

                <div className="flex items-center justify-between px-4 pb-3 pt-2">
                  <div className="text-sm font-semibold text-slate-900">
                    留言 {comments.length > 0 ? `(${comments.length})` : ""}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
                  >
                    關閉
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(84vh-170px)] overflow-y-auto px-4 py-4">
                {loadingComments ? (
                  <div className="text-sm text-slate-400">載入留言中...</div>
                ) : topLevelComments.length === 0 ? (
                  <div className="text-sm text-slate-400">還沒有留言，來留第一則吧。</div>
                ) : (
                  <div className="space-y-3">
                    {topLevelComments.map((comment) => {
                      const replies = repliesByParent[comment.id] || [];
                      const isReplying = replyingTo === comment.id;

                      return (
                        <div
                          key={comment.id}
                          className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70"
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

                          {!!comment.content && (
                            <div className="whitespace-pre-wrap pl-11 text-sm leading-6 text-slate-700">
                              {comment.content}
                            </div>
                          )}

                          {comment.media_url && comment.media_type && (
                            <div className="pl-11">
                              <MediaPreview url={comment.media_url} type={comment.media_type} />
                            </div>
                          )}

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
                                  className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70"
                                >
                                  <div className="mb-1 flex items-center gap-2">
                                    <div className="text-xs font-semibold text-slate-800">匿名用戶</div>
                                    <div className="text-[11px] text-slate-400">
                                      {formatRelativeTime(reply.created_at)}
                                    </div>
                                  </div>

                                  {!!reply.content && (
                                    <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                      {reply.content}
                                    </div>
                                  )}

                                  {reply.media_url && reply.media_type && (
                                    <MediaPreview url={reply.media_url} type={reply.media_type} />
                                  )}
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
                                className="min-h-[48px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                              />

                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                                  加照片/影片
                                  <input
                                    type="file"
                                    accept="image/*,video/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      setReplyFileMap((prev) => ({
                                        ...prev,
                                        [comment.id]: file,
                                      }));
                                    }}
                                  />
                                </label>

                                <div className="flex gap-2">
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
                                    disabled={
                                      loadingReplyId === comment.id ||
                                      (
                                        !(replyTextMap[comment.id] || "").trim() &&
                                        !replyFileMap[comment.id]
                                      )
                                    }
                                    className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                  >
                                    {loadingReplyId === comment.id ? "送出中..." : "送出回覆"}
                                  </button>
                                </div>
                              </div>

                              {replyFileMap[comment.id] && (
                                <div className="mt-2 text-xs text-slate-500">
                                  已選擇：{replyFileMap[comment.id]?.name}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 bg-white px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                    你
                  </div>

                  <div className="flex-1">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="寫下你的留言..."
                      rows={2}
                      className="min-h-[52px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                    />

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                        加照片/影片
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setCommentFile(file);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleSubmitComment}
                        disabled={loadingComment || (!commentText.trim() && !commentFile)}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50"
                      >
                        {loadingComment ? "送出中..." : "留言"}
                      </button>
                    </div>

                    {commentFile && (
                      <div className="mt-2 text-xs text-slate-500">
                        已選擇：{commentFile.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}