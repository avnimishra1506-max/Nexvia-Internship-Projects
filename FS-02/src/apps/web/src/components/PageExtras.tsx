import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type PageRole = "VIEW" | "COMMENT" | "EDIT";
type Person = { id: string; name: string; email: string; avatarUrl: string | null };
type Thread = {
  id: string;
  commentId: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
  replies: Array<{ id: string; body: string; createdAt: string; author: { id: string; name: string; avatarUrl: string | null } }>;
};
type PagePermission = { user: Person; workspaceRole: string; role: PageRole; inherited: boolean };
type Version = { id: string; description: string | null; createdAt: string; createdBy: { id: string; name: string } };
type WorkspaceInvite = { id: string; email: string; role: string; expiresAt: string; createdAt: string };

const API = (import.meta as ImportMeta & { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "http://localhost:4000";

async function api<T>(route: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${route}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function CommentsPanel({ pageId, pageRole }: { pageId: string; pageRole: PageRole }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [draft, setDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const canComment = pageRole === "COMMENT" || pageRole === "EDIT";
  const canResolve = pageRole === "EDIT";

  const load = useCallback(async () => {
    try {
      const result = await api<{ threads: Thread[] }>(`/api/pages/${pageId}/comments`);
      setThreads(result.threads);
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load comments."); }
  }, [pageId]);

  useEffect(() => { void load(); }, [load]);

  async function postComment(event: FormEvent<HTMLFormElement>, parentCommentId?: string, replyKey?: string) {
    event.preventDefault();
    const text = parentCommentId ? replyDrafts[replyKey ?? parentCommentId]?.trim() : draft.trim();
    if (!text) return;
    try {
      await api(`/api/pages/${pageId}/comments`, { method: "POST", body: JSON.stringify({ body: text, ...(parentCommentId ? { parentCommentId } : {}) }) });
      if (parentCommentId) setReplyDrafts((current) => ({ ...current, [replyKey ?? parentCommentId]: "" }));
      else setDraft("");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not post comment."); }
  }

  async function resolve(thread: Thread) {
    try {
      await api(`/api/pages/${pageId}/comments/${thread.id}`, { method: "PATCH", body: JSON.stringify({ resolved: !thread.resolved }) });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update the thread."); }
  }

  return <section className="phase5-panel" aria-label="Comments">
    <div className="section-title"><div><h2>Comments</h2><p>Discuss this page with your workspace.</p></div><span className="member-count">{threads.length}</span></div>
    {error && <p className="panel-error" role="alert">{error}</p>}
    <div className="comment-list">
      {threads.map((thread) => <article className={`comment-thread ${thread.resolved ? "resolved" : ""}`} key={thread.id}>
        <div className="comment-message"><strong>{thread.author.name}</strong><time>{formatDate(thread.createdAt)}</time><p>{thread.body}</p></div>
        {thread.replies.map((reply) => <div className="comment-message comment-reply" key={reply.id}><strong>{reply.author.name}</strong><time>{formatDate(reply.createdAt)}</time><p>{reply.body}</p></div>)}
        <div className="comment-actions">
          {canComment && <form className="reply-form" onSubmit={(event) => postComment(event, thread.commentId, thread.id)}><input aria-label={`Reply to ${thread.author.name}`} placeholder="Write a reply…" value={replyDrafts[thread.id] ?? ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))}/><button type="submit" disabled={!replyDrafts[thread.id]?.trim()}>Reply</button></form>}
          {canResolve && <button className="quiet-button" onClick={() => void resolve(thread)}>{thread.resolved ? "Reopen" : "Resolve"}</button>}
          {thread.resolved && <span className="resolved-label">Resolved</span>}
        </div>
      </article>)}
      {threads.length === 0 && <p className="panel-empty">No comments yet.</p>}
    </div>
    {canComment && <form className="comment-compose" onSubmit={(event) => postComment(event)}><textarea aria-label="New comment" placeholder="Add a comment…" rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} /><button className="primary" disabled={!draft.trim()}>Comment</button></form>}
  </section>;
}

export function PageAccessPanel({ pageId, userId, canManage, onChanged }: { pageId: string; userId: string; canManage: boolean; onChanged: () => Promise<void> }) {
  const [permissions, setPermissions] = useState<PagePermission[]>([]);
  const [error, setError] = useState("");
  const [busyUser, setBusyUser] = useState("");
  const previousRole = useRef<PageRole | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ permissions: PagePermission[] }>(`/api/pages/${pageId}/permissions`);
      setPermissions(result.permissions);
      const currentRole = result.permissions.find((permission) => permission.user.id === userId)?.role ?? null;
      const roleChanged = previousRole.current !== null && currentRole !== previousRole.current;
      previousRole.current = currentRole;
      if (roleChanged) await onChanged();
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load page access."); }
  }, [pageId, userId, onChanged]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function setRole(userId: string, role: string) {
    setBusyUser(userId);
    try {
      if (role === "INHERIT") await api(`/api/pages/${pageId}/permissions/${userId}`, { method: "DELETE" });
      else await api(`/api/pages/${pageId}/permissions/${userId}`, { method: "PUT", body: JSON.stringify({ role }) });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update page access."); }
    finally { setBusyUser(""); }
  }

  return <section className="phase5-panel" aria-label="Page access">
    <div className="section-title"><div><h2>Page access</h2><p>{canManage ? "Choose each member’s access to this page." : "Access follows your workspace membership."}</p></div></div>
    {error && <p className="panel-error" role="alert">{error}</p>}
    <div className="access-list">{permissions.map((permission) => <div className="access-row" key={permission.user.id}>
      <div className="avatar">{permission.user.name.slice(0, 1).toUpperCase()}</div>
      <div className="member-info"><strong>{permission.user.name}</strong><span>{permission.user.email}</span></div>
      {canManage ? <select aria-label={`Access for ${permission.user.name}`} value={permission.inherited ? "INHERIT" : permission.role} disabled={busyUser === permission.user.id} onChange={(event) => void setRole(permission.user.id, event.target.value)}>
        <option value="INHERIT">Workspace default ({permission.workspaceRole === "VIEWER" ? "View" : "Edit"})</option><option value="VIEW">View</option><option value="COMMENT">Comment</option><option value="EDIT">Edit</option>
      </select> : <span className="member-role">{permission.role}</span>}
    </div>)}</div>
  </section>;
}

function snapshotText(snapshot: unknown): string {
  const render = (value: unknown): string => {
    if (!value || typeof value !== "object") return "";
    const node = value as { type?: string; text?: string; content?: unknown[] };
    if (typeof node.text === "string") return node.text;
    const children = (node.content ?? []).map(render).join("");
    if (node.type === "hardBreak") return "\n";
    if (["paragraph", "heading", "blockquote", "codeBlock", "listItem"].includes(node.type ?? "")) {
      return `${node.type === "listItem" ? "• " : ""}${children}\n`;
    }
    return children;
  };
  return render(snapshot).trim() || "This saved version has no text content.";
}

export function VersionHistoryPanel({ pageId, canEdit, open, onClose, onSaved, getSnapshot, restoreSnapshot }: {
  pageId: string;
  canEdit: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  getSnapshot: () => unknown;
  restoreSnapshot: (snapshot: unknown) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ version: Version; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ versions: Version[] }>(`/api/pages/${pageId}/versions`);
      setVersions(result.versions);
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load version history."); }
  }, [pageId]);

  useEffect(() => { if (open) void load(); }, [load, open]);

  async function previewVersion(version: Version) {
    setBusy(true);
    try {
      const result = await api<{ snapshot: unknown }>(`/api/pages/${pageId}/versions/${version.id}`);
      setPreview({ version, text: snapshotText(result.snapshot) });
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not preview this version."); }
    finally { setBusy(false); }
  }

  async function saveVersion() {
    const description = window.prompt("Describe this version (optional)", "");
    if (description === null) return;
    setBusy(true);
    try {
      await api(`/api/pages/${pageId}/versions`, { method: "POST", body: JSON.stringify({ snapshot: getSnapshot(), description }) });
      onSaved();
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save this version."); }
    finally { setBusy(false); }
  }

  async function restore(version: Version) {
    if (!window.confirm(`Restore “${version.description || formatDate(version.createdAt)}”? Current editor content will be replaced.`)) return;
    setBusy(true);
    try {
      const result = await api<{ snapshot: unknown }>(`/api/pages/${pageId}/versions/${version.id}/restore`, { method: "POST" });
      restoreSnapshot(result.snapshot);
      onSaved();
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not restore this version."); }
    finally { setBusy(false); }
  }

  if (!open) return null;
  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="history-drawer" role="dialog" aria-modal="true" aria-label="Version history">
    <div className="drawer-heading"><div><p className="eyebrow">PAGE HISTORY</p><h2>Version history</h2></div><button className="icon-button" aria-label="Close history" onClick={onClose}>×</button></div>
    <p className="drawer-intro">Review a saved version before restoring it. Recent edits are saved automatically.</p>
    {canEdit && <button className="primary" onClick={() => void saveVersion()} disabled={busy}>Save version</button>}
    {error && <p className="panel-error" role="alert">{error}</p>}
    <div className="version-list">{versions.map((version) => <div className="version-row" key={version.id}>
      <div><strong>{version.description || "Saved version"}</strong><span>{version.createdBy.name} · {formatDate(version.createdAt)}</span></div>
      <div className="version-actions"><button className="quiet-button" onClick={() => void previewVersion(version)} disabled={busy}>Preview</button>{canEdit && <button className="quiet-button" onClick={() => void restore(version)} disabled={busy}>Restore</button>}</div>
    </div>)}{versions.length === 0 && <p className="panel-empty">No saved versions yet.</p>}</div>
      {preview && <section className="version-preview" aria-label="Version preview"><div className="section-title"><div><h3>Preview</h3><p>{preview.version.createdBy.name} · {formatDate(preview.version.createdAt)}</p></div><button className="icon-button close-button" aria-label="Close preview" onClick={() => setPreview(null)}>&times;</button></div><pre>{preview.text}</pre>{canEdit && <button className="primary" onClick={() => void restore(preview.version)} disabled={busy}>Restore this version</button>}</section>}
    </aside>
  </div>;
}

export function WorkspaceInvitesPanel({ workspaceId, canManage, refreshKey }: { workspaceId: string; canManage: boolean; refreshKey: number }) {
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [error, setError] = useState("");
  const [busyInvite, setBusyInvite] = useState("");
  const load = useCallback(async () => {
    if (!canManage) return;
    try {
      const result = await api<{ invites: WorkspaceInvite[] }>(`/api/workspaces/${workspaceId}/invites`);
      setInvites(result.invites);
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load pending invitations."); }
  }, [workspaceId, canManage]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  async function revoke(invite: WorkspaceInvite) {
    setBusyInvite(invite.id);
    try {
      await api(`/api/workspaces/${workspaceId}/invites/${invite.id}`, { method: "DELETE" });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not revoke this invitation."); }
    finally { setBusyInvite(""); }
  }

  if (!canManage) return null;
  return <section className="pending-invites" aria-label="Pending workspace invitations">
    <h3>Pending invitations</h3>
    {error && <p className="panel-error" role="alert">{error}</p>}
    {invites.map((invite) => <div className="pending-invite-row" key={invite.id}><div><strong>{invite.email}</strong><span>{invite.role} · expires {formatDate(invite.expiresAt)}</span></div><button className="quiet-button" disabled={busyInvite === invite.id} onClick={() => void revoke(invite)}>Revoke</button></div>)}
    {invites.length === 0 && !error && <p className="panel-empty">No pending invitations.</p>}
  </section>;
}
