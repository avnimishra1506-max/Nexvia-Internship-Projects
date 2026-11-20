"use client";

import React, { useEffect, useState } from "react";
import { CommentThreadItem, PermissionRole } from "@/types";
import { Check, CheckCircle2, MessageSquare, Send, X } from "lucide-react";

interface CommentsProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle?: string;
  documentId: string;
  permission: PermissionRole;
}

export const Comments: React.FC<CommentsProps> = ({ isOpen, onClose, documentId, permission }) => {
  const [threads, setThreads] = useState<CommentThreadItem[]>([]);
  const [error, setError] = useState("");
  const [newCommentText, setNewCommentText] = useState("");
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen || !documentId) return;
    fetch(`/api/comments?documentId=${encodeURIComponent(documentId)}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load comments");
      setThreads(data.threads ?? []);
      setError("");
    }).catch((reason) => setError(reason.message));
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handleResolveThread = async (thread: CommentThreadItem) => {
    const response = await fetch("/api/comments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: thread.id, resolved: !thread.resolved }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Could not update thread"); return; }
    setThreads((prev) => prev.map((item) => item.id === thread.id ? { ...item, resolved: data.thread.resolved } : item));
  };

  const handleAddThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId, content: newCommentText.trim() }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Could not post comment"); return; }
    setThreads((prev) => [data.thread, ...prev]);
    setError("");
    setNewCommentText("");
  };

  const handleAddReply = async (threadId: string) => {
    const replyText = replyTextMap[threadId];
    if (!replyText || !replyText.trim()) return;

    const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId, threadId, content: replyText.trim() }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Could not post reply"); return; }
    setThreads((prev) => prev.map((thread) => thread.id === threadId ? { ...thread, comments: [...thread.comments, data.comment] } : thread));

    setReplyTextMap({ ...replyTextMap, [threadId]: "" });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">Comments</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold">
            {threads.filter((t) => !t.resolved).length} open
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && <div role="alert" className="px-4 py-2 text-xs text-rose-700 bg-rose-50">{error}</div>}

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className={`p-4 rounded-xl border transition-all ${
              thread.resolved
                ? "bg-slate-100/70 border-slate-200 opacity-75"
                : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            {/* Thread Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: thread.author.cursorColor }}
                >
                  {thread.author.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-800">{thread.author.name}</span>
              </div>

              {permission === "EDIT" && <button
                onClick={() => handleResolveThread(thread)}
                className={`p-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  thread.resolved
                    ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                    : "text-slate-400 hover:text-emerald-600 hover:bg-slate-100"
                }`}
                title={thread.resolved ? "Reopen thread" : "Mark as resolved"}
              >
                {thread.resolved ? <CheckCircle2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                <span className="text-[10px]">{thread.resolved ? "Resolved" : "Resolve"}</span>
              </button>}
            </div>

            {/* Comments inside thread */}
            <div className="space-y-2.5">
              {thread.comments.map((comment) => (
                <div key={comment.id} className="text-xs">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span className="font-medium text-slate-700">{comment.author.name}</span>
                    <span>{new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-slate-700 bg-slate-50/80 p-2 rounded-lg leading-relaxed border border-slate-100">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Quick reply box */}
            {!thread.resolved && permission !== "VIEW" && (
              <div className="mt-3 pt-2 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  value={replyTextMap[thread.id] || ""}
                  onChange={(e) => setReplyTextMap({ ...replyTextMap, [thread.id]: e.target.value })}
                  placeholder="Reply..."
                  onKeyDown={(e) => e.key === "Enter" && handleAddReply(thread.id)}
                  className="flex-1 text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleAddReply(thread.id)}
                  className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New Comment Footer Form */}
      {permission !== "VIEW" ? <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleAddThread} className="space-y-2">
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Add a new comment thread..."
            rows={2}
            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none text-slate-800"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Post Comment</span>
            </button>
          </div>
        </form>
      </div> : <div className="p-4 text-xs text-slate-500 border-t border-slate-100">You have view-only access to this page.</div>}
    </div>
  );
};

