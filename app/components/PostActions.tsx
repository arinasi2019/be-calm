"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";

type CommentItem = {
  id: number;
  post_id: number;
  user_id?: string | null;
  content: string;
  created_at: string | null;
  parent_id?: number | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
};

type VoteItem = {
  id: number;
  post_id: number;
  user_id?: string | null;
};

type ProfileItem = {
  id: string;
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
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

function getProfileName(profile?: ProfileItem | null, fallbackEmail?: string | null) {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  if (profile?.username?.trim()) return profile.username.trim();
  if (profile?.email?.trim()) return profile.email.split("@")[0];
  if (fallbackEmail?.trim()) return fallbackEmail.split("@")[0];
  return "會員";
}

function getProfileInitial(profile?: ProfileItem | null, fallbackEmail?: string | null) {
  return getProfileName(profile, fallbackEmail).slice(0, 1).toUpperCase();
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
    media_type: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
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
  const router = useRouter();
  const { user } = useAuth();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileItem>>({});
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

  const replyBoxRefs = useRef<Record<number, HTMLDivElement | null>>({});

  async function loadProfiles(userIds: string[]) {
    if (userIds.length === 0) {
      setProfilesMap({});
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, username, display_name, avatar_url")
      .in("id", userIds);

    if (error) {
      console.error("載入 profiles 失敗：", error.message);
      return;
    }

    const nextMap: Record<string, ProfileItem> = {};
    ((data as ProfileItem[]) || []).forEach((profile) => {
      nextMap[profile.id] = profile;
    });
    setProfilesMap(nextMap);
  }

  async function loadComments() {
    setLoadingComments(true);

    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, user_id, content, created_at, parent_id, media_url, media_type")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!error) {
      const rows = ((data ?? []) as CommentItem[]) || [];
      setComments(rows);

      const userIds = Array.from(
        new Set(rows.map((item) => item.user_id).filter(Boolean) as string[])
      );
      await loadProfiles(userIds);
    }

    setLoadingComments(false);
  }

  async function loadVotes() {
    const { data, error } = await supabase
      .from("votes")
      .select("id, post_id, user_id")
      .eq("post_id", postId);

    if (!error) {
      const voteRows = ((data ?? []) as VoteItem[]) || [];
      setPitCount(voteRows.length);

      if (user) {
        const mine = voteRows.find((item) => item.user_id === user.id);
        setHasPitted(!!mine);
        setUserVoteId(mine?.id ?? null);
      } else {
        setHasPitted(false);
        setUserVoteId(null);
      }
    }
  }

  useEffect(() => {
    loadComments();
    loadVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?.id]);

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

  useEffect(() => {
    if (!replyingTo) return;
    const el = replyBoxRefs.current[replyingTo];
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  }, [replyingTo]);

  function goLogin() {
    router.push("/login");
  }

  async function handlePitToggle() {
    if (!user) {
      goLogin();
      return;
    }

    if (loadingPit) return;

    setLoadingPit(true);

    if (!hasPitted) {
      setPitCount((prev) => prev + 1);
      setHasPitted(true);

      const { data, error } = await supabase
        .from("votes")
        .insert([{ post_id: postId, user_id: user.id }])
        .select("id")
        .single();

      if (error) {
        setPitCount((prev) => Math.max(0, prev - 1));
        setHasPitted(false);
        alert("按坑失敗：" + error.message);
        setLoadingPit(false);
        return;
      }

      setUserVoteId(data?.id ?? null);
      setLoadingPit(false);
      return;
    }

    setPitCount((prev) => Math.max(0, prev - 1));
    setHasPitted(false);

    const { error } = userVoteId
      ? await supabase.from("votes").delete().eq("id", userVoteId).eq("user_id", user.id)
      : await supabase.from("votes").delete().eq("post_id", postId).eq("user_id", user.id);

    if (error) {
      setPitCount((prev) => prev + 1);
      setHasPitted(true);
      alert("取消坑失敗：" + error.message);
      setLoadingPit(false);
      return;
    }

    setUserVoteId(null);
    setLoadingPit(false);
  }

  async function handleSubmitComment() {
    if (!user) {
      goLogin();
      return;
    }

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
        user_id: user.id,
        content,
        created_at: new Date().toISOString(),
        parent_id: null,
        media_url: uploadedMedia.media_url,
        media_type: uploadedMedia.media_type,
      };

      setComments((prev) => [...prev, optimisticComment]);
      setProfilesMap((prev) => ({
        ...prev,
        [user.id]: {
          id: user.id,
          email: user.email,
          display_name: prev[user.id]?.display_name ?? null,
          username: prev[user.id]?.username ?? null,
          avatar_url: prev[user.id]?.avatar_url ?? null,
        },
      }));
      setCommentText("");
      setCommentFile(null);

      const { data, error } = await supabase
        .from("comments")
        .insert([
          {
            post_id: postId,
            user_id: user.id,
            content,
            created_at: new Date().toISOString(),
            parent_id: null,
            media_url: uploadedMedia.media_url,
            media_type: uploadedMedia.media_type,
          },
        ])
        .select("id, post_id, user_id, content, created_at, parent_id, media_url, media_type")
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
    if (!user) {
      goLogin();
      return;
    }

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
        user_id: user.id,
        content,
        created_at: new Date().toISOString(),
        parent_id: parentId,
        media_url: uploadedMedia.media_url,
        media_type: uploadedMedia.media_type,
      };

      setComments((prev) => [...prev, optimisticReply]);
      setProfilesMap((prev) => ({
        ...prev,
        [user.id]: {
          id: user.id,
          email: user.email,
          display_name: prev[user.id]?.display_name ?? null,
          username: prev[user.id]?.username ?? null,
          avatar_url: prev[user.id]?.avatar_url ?? null,
        },
      }));
      setReplyTextMap((prev) => ({ ...prev, [parentId]: "" }));
      setReplyFileMap((prev) => ({ ...prev, [parentId]: null }));

      const { data, error } = await supabase
        .from("comments")
        .insert([
          {
            post_id: postId,
            user_id: user.id,
            content,
            created_at: new Date().toISOString(),
            parent_id: parentId,
            media_url: uploadedMedia.media_url,
            media_type: uploadedMedia.media_type,
          },
        ])
        .select("id, post_id, user_id, content, created_at, parent_id, media_url, media_type")
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

  function toggleReply(commentId: number) {
    if (!user) {
      goLogin();
      return;
    }
    setReplyingTo((prev) => (prev === commentId ? null : commentId));
  }

  const myProfile = user ? profilesMap[user.id] : null;
  const myDisplayName = getProfileName(myProfile, user?.email ?? null);

  const topLevelComments = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);

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
            className={`h-[16px] w-[16px] transition-transform duration-150 ${sheetOpen ? "scale-110" : ""}`}
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
            <div className="flex max-h-[84vh] flex-col overflow-hidden rounded-t-[32px] border border-slate-200/70 bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.22)]">
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

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {loadingComments ? (
                  <div className="text-sm text-slate-400">載入留言中...</div>
                ) : topLevelComments.length === 0 ? (
                  <div className="text-sm text-slate-400">還沒有留言，來留第一則吧。</div>
                ) : (
                  <div className="space-y-3">
                    {topLevelComments.map((comment) => {
                      const replies = repliesByParent[comment.id] || [];
                      const isReplying = replyingTo === comment.id;
                      const commentProfile = comment.user_id ? profilesMap[comment.user_id] : null;
                      const commentName = getProfileName(commentProfile);

                      return (
                        <div
                          key={comment.id}
                          className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70"
                        >
                          <div className="mb-2 flex items-center gap-3">
                            {commentProfile?.avatar_url ? (
                              <img
                                src={commentProfile.avatar_url}
                                alt={commentName}
                                className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                                {getProfileInitial(commentProfile)}
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">
                                {commentName}
                              </div>
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
                              onClick={() => toggleReply(comment.id)}
                              className="text-xs font-medium text-slate-500 hover:text-slate-900"
                            >
                              {isReplying ? "收起回覆" : "回覆"}
                            </button>
                          </div>

                          {replies.length > 0 && (
                            <div className="mt-3 space-y-2 pl-11">
                              {replies.map((reply) => {
                                const replyProfile = reply.user_id ? profilesMap[reply.user_id] : null;
                                const replyName = getProfileName(replyProfile);

                                return (
                                  <div
                                    key={reply.id}
                                    className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70"
                                  >
                                    <div className="mb-1 flex items-center gap-2">
                                      {replyProfile?.avatar_url ? (
                                        <img
                                          src={replyProfile.avatar_url}
                                          alt={replyName}
                                          className="h-6 w-6 rounded-full object-cover ring-1 ring-slate-200"
                                        />
                                      ) : (
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                                          {getProfileInitial(replyProfile)}
                                        </div>
                                      )}

                                      <div className="text-xs font-semibold text-slate-800">
                                        {replyName}
                                      </div>
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
                                );
                              })}
                            </div>
                          )}

                          {isReplying && user && (
                            <div
                              ref={(el) => {
                                replyBoxRefs.current[comment.id] = el;
                              }}
                              className="mt-3 pl-11"
                            >
                              <textarea
                                value={replyTextMap[comment.id] || ""}
                                onChange={(e) =>
                                  setReplyTextMap((prev) => ({
                                    ...prev,
                                    [comment.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmitReply(comment.id);
                                  }
                                }}
                                placeholder="回覆這則留言...（Enter 送出，Shift+Enter 換行）"
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
                                      (!(replyTextMap[comment.id] || "").trim() &&
                                        !replyFileMap[comment.id])
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
                {user ? (
                  <div className="flex items-start gap-3">
                    {myProfile?.avatar_url ? (
                      <img
                        src={myProfile.avatar_url}
                        alt={myDisplayName}
                        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                        {getProfileInitial(myProfile, user.email ?? null)}
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="mb-2 text-sm font-semibold text-slate-900">
                        {myDisplayName}
                      </div>

                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmitComment();
                          }
                        }}
                        placeholder="寫下你的留言...（Enter 送出，Shift+Enter 換行）"
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
                          {loadingComment ? "送出中..." : "送出留言"}
                        </button>
                      </div>

                      {commentFile && (
                        <div className="mt-2 text-xs text-slate-500">
                          已選擇：{commentFile.name}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600 ring-1 ring-slate-200/70">
                    先看看大家的留言。想留言、回覆或附圖時，再登入就可以。
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={goLogin}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                      >
                        前往登入
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}