import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./theme.css";
import { CommentsPanel, PageAccessPanel, WorkspaceInvitesPanel } from "./components/PageExtras";

const PageEditor = lazy(() => import("./components/PageEditor").then((module) => ({ default: module.PageEditor })));

type User = { id: string; name: string; email: string; avatarUrl: string | null; cursorColor?: string };
type Page = { id: string; title: string; parentId: string | null; updatedAt: string; accessRole?: "VIEW" | "COMMENT" | "EDIT" };
type Member = { user: User; role: string };
type Workspace = { id: string; name: string; role: string; pages: Page[]; members: Member[] };
type InvitePreview = { email: string; role: string; workspaceName: string; expiresAt: string };
const API = (import.meta as ImportMeta & { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "http://localhost:4000";

async function api<T>(route: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${route}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function App() {
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get("invite") ?? "");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState("");
  const [inviteRefresh, setInviteRefresh] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState<"profile" | "account" | "workspace" | null>(null);
  const [profileForm, setProfileForm] = useState({ name: "", avatarUrl: "", cursorColor: "#4f8cff" });
  const [accountForm, setAccountForm] = useState({ email: "", currentPassword: "", newPassword: "" });
  const [settingsFeedback, setSettingsFeedback] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => (localStorage.getItem("collab-theme") as "system" | "light" | "dark") ?? "dark");
  const [autoSaveMinutes, setAutoSaveMinutes] = useState(() => Number(localStorage.getItem("collab-auto-save-minutes") ?? 5));
  const [workspaceSwitchOpen, setWorkspaceSwitchOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState(() => new URLSearchParams(window.location.search).get("workspace") ?? "");
  const [pageId, setPageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">(() => new URLSearchParams(window.location.search).has("invite") ? "register" : "login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const workspace = workspaces.find((item) => item.id === workspaceId) ?? workspaces[0];
  const activePage = workspace?.pages.find((item) => item.id === pageId) ?? workspace?.pages[0];
  const activePageRole = activePage?.accessRole ?? (workspace?.role === "VIEWER" ? "VIEW" : "EDIT");

  useEffect(() => {
    const applyTheme = () => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.dataset.theme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
    };
    applyTheme();
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  const loadWorkspaces = useCallback(async (preferId?: string) => {
    const result = await api<{ workspaces: Workspace[] }>("/api/workspaces");
    setWorkspaces(result.workspaces);
    setWorkspaceId((current) => preferId && result.workspaces.some((w) => w.id === preferId) ? preferId : result.workspaces.some((w) => w.id === current) ? current : result.workspaces[0]?.id ?? "");
  }, []);

  function clearInviteToken() {
    setInviteToken("");
    setInvitePreview(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  useEffect(() => {
    if (!inviteToken) return;
    let active = true;
    api<{ invite: InvitePreview }>(`/api/invites/${inviteToken}`).then(({ invite }) => {
      if (!active) return;
      setInvitePreview(invite);
      setAuthForm((current) => ({ ...current, email: invite.email }));
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "This invitation is unavailable.");
    });
    return () => { active = false; };
  }, [inviteToken]);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me").then(async ({ user: currentUser }) => {
      setUser(currentUser);
      let preferredWorkspaceId: string | undefined;
      if (inviteToken) {
        try {
          const accepted = await api<{ workspaceId: string }>(`/api/invites/${inviteToken}/accept`, { method: "POST" });
          preferredWorkspaceId = accepted.workspaceId;
          clearInviteToken();
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not accept this invitation."); }
      }
      await loadWorkspaces(preferredWorkspaceId);
    }).catch(() => undefined).finally(() => setLoading(false));
  }, [inviteToken, loadWorkspaces]);

  useEffect(() => {
    if (workspace && !workspace.pages.some((page) => page.id === pageId)) setPageId(workspace.pages[0]?.id ?? "");
  }, [workspace, pageId]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = authMode === "login" ? { email: authForm.email, password: authForm.password } : { ...authForm, ...(inviteToken ? { inviteToken } : {}) };
      const result = await api<{ user: User }>(path, { method: "POST", body: JSON.stringify(body) });
      setUser(result.user);
      let preferredWorkspaceId: string | undefined;
      if (inviteToken && authMode === "login") {
        try {
          const accepted = await api<{ workspaceId: string }>(`/api/invites/${inviteToken}/accept`, { method: "POST" });
          preferredWorkspaceId = accepted.workspaceId;
        }
        catch (caught) { await loadWorkspaces(); throw caught; }
      }
      if (inviteToken) clearInviteToken();
      await loadWorkspaces(preferredWorkspaceId);
    });
  }
  async function logout() {
    await run(async () => { await api("/api/auth/logout", { method: "POST" }); setUser(null); setWorkspaces([]); setPageId(""); });
  }
  async function createWorkspace() {
    const name = window.prompt("Name your workspace");
    if (!name?.trim()) return;
    await run(async () => { const result = await api<{ workspace: { id: string } }>("/api/workspaces", { method: "POST", body: JSON.stringify({ name }) }); await loadWorkspaces(result.workspace.id); });
  }
  async function renameWorkspace() {
    if (!workspace) return;
    const name = window.prompt("New workspace name", workspace.name);
    if (!name?.trim()) return;
    await run(async () => { await api(`/api/workspaces/${workspace.id}`, { method: "PATCH", body: JSON.stringify({ name }) }); await loadWorkspaces(workspace.id); });
  }
  async function deleteWorkspace() {
    if (!workspace || !window.confirm(`Delete '${workspace.name}' and its pages?`)) return;
    await run(async () => { await api(`/api/workspaces/${workspace.id}`, { method: "DELETE" }); await loadWorkspaces(); });
  }
  async function createPage(parentId: string | null = null) {
    if (!workspace) return;
    await run(async () => { const result = await api<{ page: Page }>(`/api/workspaces/${workspace.id}/pages`, { method: "POST", body: JSON.stringify({ title: "Untitled page", parentId }) }); await loadWorkspaces(workspace.id); setPageId(result.page.id); });
  }
  async function renamePage(page: Page) {
    const title = window.prompt("Page title", page.title);
    if (!title?.trim()) return;
    await run(async () => { await api(`/api/pages/${page.id}`, { method: "PATCH", body: JSON.stringify({ title }) }); await loadWorkspaces(workspace!.id); });
  }
  async function deletePage(page: Page) {
    if (!window.confirm(`Delete '${page.title}' and any nested pages?`)) return;
    await run(async () => { await api(`/api/pages/${page.id}`, { method: "DELETE" }); await loadWorkspaces(workspace!.id); });
  }
  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await run(async () => {
      const result = await api<{ invite?: { url: string }; message: string }>(`/api/workspaces/${workspace.id}/invites`, { method: "POST", body: JSON.stringify({ email: form.get("email"), role: form.get("role") }) });
      setInviteLink(result.invite?.url ?? "");
      setInviteFeedback(result.message);
      setInviteCopied(false);
      setInviteRefresh((current) => current + 1);
      formElement.reset();
      await loadWorkspaces(workspace.id);
    });
  }
  async function removeMember(member: Member) {
    if (!workspace || !window.confirm(`Remove ${member.user.name} from this workspace?`)) return;
    await run(async () => {
      await api(`/api/workspaces/${workspace.id}/members/${member.user.id}`, { method: "DELETE" });
      await loadWorkspaces(workspace.id);
    });
  }
  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSettingsError(""); setSettingsFeedback("");
    setBusy(true);
    try {
      const result = await api<{ user: User }>("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ ...profileForm, avatarUrl: profileForm.avatarUrl.trim() || null }) });
      setUser(result.user); setSettingsFeedback("Profile saved."); await loadWorkspaces(workspace?.id);
    } catch (caught) { setSettingsError(caught instanceof Error ? caught.message : "Could not save profile."); }
    finally { setBusy(false); }
  }
  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSettingsError(""); setSettingsFeedback("");
    setBusy(true);
    try {
      const result = await api<{ user: User }>("/api/auth/account", { method: "PATCH", body: JSON.stringify({ email: accountForm.email.trim() || undefined, currentPassword: accountForm.currentPassword, newPassword: accountForm.newPassword || undefined }) });
      setUser(result.user); setAccountForm({ email: result.user.email, currentPassword: "", newPassword: "" }); setSettingsFeedback("Account updated.");
    } catch (caught) { setSettingsError(caught instanceof Error ? caught.message : "Could not update account."); }
    finally { setBusy(false); }
  }

  const pages = useMemo(() => workspace?.pages ?? [], [workspace]);
  if (loading) return <main className="loading"><div className="spinner" />Loading your workspace...</main>;
  if (!user) return <main className="auth-shell">
    <section className="auth-card">
      <div className="brand-mark"><img src="/favicon.svg" alt="Collab Workspace logo" /></div><p className="eyebrow">A calmer place to work together</p>
      {invitePreview && <div className="invite-preview"><strong>You're invited to {invitePreview.workspaceName}</strong><span>Join as {invitePreview.role.toLowerCase()}. Sign in or create an account for {invitePreview.email}.</span><small>Invitation expires {new Date(invitePreview.expiresAt).toLocaleString()}.</small></div>}
      <h1>{invitePreview ? `Join ${invitePreview.workspaceName}` : authMode === "login" ? "Welcome back" : "Create your workspace"}</h1>
      <p className="subtle">{authMode === "login" ? "Sign in to pick up where your team left off." : invitePreview ? "Create your account to accept this workspace invitation." : "Start with a shared space for your team."}</p>
      {error && <div className="notice error" role="alert">{error}{inviteToken && !invitePreview && <button className="text-button" onClick={() => { setError(""); clearInviteToken(); }}>Continue without invitation</button>}</div>}
      <form onSubmit={authenticate} className="stack-form">
        {authMode === "register" && <label>Your name<input required autoComplete="name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} /></label>}
        <label>Email<input required type="email" autoComplete="email" readOnly={Boolean(inviteToken)} value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></label>
        <label>Password<input required type="password" minLength={authMode === "register" ? 12 : 1} autoComplete={authMode === "login" ? "current-password" : "new-password"} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />{authMode === "register" && <small>Use at least 12 characters.</small>}</label>
        <button className="primary full" disabled={busy}>{busy ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <p className="switch-auth">{authMode === "login" ? "New to Collab Workspace?" : "Already have an account?"} <button className="text-button" onClick={() => { setError(""); setAuthMode(authMode === "login" ? "register" : "login"); }}> {authMode === "login" ? "Create an account" : "Sign in"}</button></p>
    </section>
  </main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark small"><img src="/favicon.svg" alt="" /></div><span>Collabspace</span><span className="plan">TEAM</span></div>
      <div className="workspace-picker"><span className="workspace-avatar">{workspace?.name.slice(0, 1).toUpperCase() ?? "C"}</span><select aria-label="Choose workspace" value={workspace?.id ?? ""} onChange={(e) => setWorkspaceId(e.target.value)}>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="icon-button" title="Create workspace" onClick={createWorkspace}>+</button></div>
      <div className="nav-label">WORKSPACE</div>
      <div className="pages-heading"><span>Pages</span><button className="icon-button" title="Create page" onClick={() => createPage()}>+</button></div>
      <nav className="page-list" aria-label="Workspace pages">
        {pages.map((page) => <div key={page.id} className={`page-row ${activePage?.id === page.id ? "selected" : ""} ${page.parentId ? "nested" : ""}`}>
          <button className="page-select" onClick={() => setPageId(page.id)}><span className="page-glyph">{page.parentId ? ">" : "□"}</span><span>{page.title}</span></button>
          <div className="row-actions"><button title="Add nested page" onClick={() => createPage(page.id)}>+</button><button title="Rename page" onClick={() => renamePage(page)}>...</button></div>
        </div>)}
        {pages.length === 0 && <p className="empty-sidebar">No pages yet. Create one to get started.</p>}
      </nav>
      <div className="sidebar-bottom" />
      <div className="user-card">{user.avatarUrl ? <img className="avatar user-avatar-image" src={user.avatarUrl} alt="" /> : <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>}<div className="user-copy"><strong>{user.name}</strong><span>{user.email}</span></div><button className="icon-button settings-trigger" onClick={() => { setWorkspaceSwitchOpen(false); setSettingsOpen(true); }} title="Settings" aria-label="Settings">{"\u2699"}</button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>{workspace?.name}</span><span className="crumb-sep">/</span><strong>{activePage?.title ?? "Workspace overview"}</strong></div><div className="top-actions"><div className="avatar-stack" title={`${workspace?.members.length ?? 0} members`}>{workspace?.members.slice(0, 4).map((member, index) => <div key={member.user.id} className={`avatar member-avatar c${index}`} title={member.user.name}>{member.user.name.slice(0, 1).toUpperCase()}</div>)}</div><button className="outline-button" onClick={() => setHistoryOpen(true)} disabled={!activePage}>History</button><button className="outline-button" onClick={() => setShareOpen(true)}>Share</button></div></header>
      <div className="workspace-content">
      <div className="content-scroll">
        {error && <div className="notice error content-notice" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
        {activePage ? <article className="document">
          <div className="document-kicker">TEAM DOCUMENT</div><div className="page-title-row"><h1>{activePage.title}</h1><button className="icon-button title-edit" title="Rename page" onClick={() => renamePage(activePage)}>...</button></div>
          <p className="document-meta">Last updated {new Date(activePage.updatedAt).toLocaleString()}</p>
          <div className="phase-note"><span className="note-icon">*</span><div><strong>Shared editing is ready</strong><p>Edits sync live with workspace members. Comments and saved versions are available below.</p></div></div>
          <Suspense fallback={<div className="editor-loading"><span className="spinner" />Loading editor tools...</div>}>
            <PageEditor key={`${user.id}:${activePage.id}:${activePageRole}`} pageId={activePage.id} userId={user.id} userName={user.name} userCursorColor={user.cursorColor} editable={activePageRole === "EDIT"} historyOpen={historyOpen} onHistoryClose={() => setHistoryOpen(false)} autoSaveMinutes={autoSaveMinutes} />
          </Suspense>
          <div className="share-modal-backdrop" hidden={!shareOpen} onMouseDown={(event) => { if (event.target === event.currentTarget) setShareOpen(false); }}><section className="share-dialog" role="dialog" aria-modal="true" aria-label="Share workspace"><div className="drawer-heading"><div><p className="eyebrow">SHARED ACCESS</p><h2>Share {activePage.title}</h2></div><button className="icon-button close-button" aria-label="Close share" onClick={() => setShareOpen(false)}>&times;</button></div>
          <PageAccessPanel key={`access:${activePage.id}`} pageId={activePage.id} userId={user.id} canManage={workspace?.role === "OWNER" || workspace?.role === "ADMIN"} onChanged={() => loadWorkspaces(workspace?.id)} />
          <section className="members-section" id="members"><div className="section-title"><div><h2>People in this workspace</h2><p>Invite an existing account or share an expiring link.</p></div><span className="member-count">{workspace?.members.length ?? 0}</span></div>
            {workspace?.members.map((member) => <div className="member-row" key={member.user.id}><div className="avatar">{member.user.name.slice(0, 1).toUpperCase()}</div><div className="member-info"><strong>{member.user.name}</strong><span>{member.user.email}</span></div><span className="member-role">{member.role}</span>{(workspace.role === "OWNER" || (workspace.role === "ADMIN" && member.role !== "ADMIN")) && member.user.id !== user.id && <button className="quiet-button" onClick={() => void removeMember(member)}>Remove</button>}</div>)}
            {workspace?.role === "OWNER" || workspace?.role === "ADMIN" ? <form className="invite-form" onSubmit={inviteMember}><input name="email" type="email" required placeholder="teammate@example.com" aria-label="Teammate email"/><select name="role" aria-label="Workspace role"><option value="MEMBER">Member</option><option value="ADMIN">Admin</option><option value="VIEWER">Viewer</option></select><button className="primary" disabled={busy}>Invite</button></form> : null}
            {inviteFeedback && <p className="invite-feedback" role="status">{inviteFeedback}</p>}
            {inviteLink && <div className="invite-link"><div><strong>Invitation link ready</strong><span>It expires in seven days. Share it with the invited person.</span></div><input aria-label="Invitation link" readOnly value={inviteLink}/><button className="outline-button" onClick={() => { void navigator.clipboard.writeText(inviteLink).then(() => setInviteCopied(true)).catch(() => window.prompt("Copy this invitation link", inviteLink)); }}> {inviteCopied ? "Copied" : "Copy link"}</button></div>}
            {workspace && <WorkspaceInvitesPanel workspaceId={workspace.id} canManage={workspace.role === "OWNER" || workspace.role === "ADMIN"} refreshKey={inviteRefresh} />}
          </section></section></div>
          {activePage && <button className="delete-page" onClick={() => deletePage(activePage)}>Delete this page</button>}
        </article> : <section className="empty-state"><div className="empty-icon">&#9635;</div><h1>Make this space yours</h1><p>Create your first shared page to collect plans, notes, and ideas.</p><button className="primary" onClick={() => createPage()}>+ Create a page</button></section>}
      </div>
{activePage && <aside className="comments-rail"><CommentsPanel key={`comments:${activePage.id}`} pageId={activePage.id} pageRole={activePageRole} /></aside>}
      </div>
      {settingsOpen && <div className="settings-menu-backdrop" onClick={() => { setSettingsOpen(false); setWorkspaceSwitchOpen(false); }}>
        <section className="settings-menu" aria-label="Settings menu" onClick={(event) => event.stopPropagation()}>
          <div className="settings-menu-user">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>}<div><strong>{user.name}</strong><span>{user.email}</span></div></div>
          <button className="settings-menu-item" onClick={() => { setProfileForm({ name: user.name, avatarUrl: user.avatarUrl ?? "", cursorColor: user.cursorColor ?? "#4f8cff" }); setSettingsPage("profile"); setSettingsOpen(false); }}><span className="menu-symbol">&#9787;</span>Profile</button>
          <button className="settings-menu-item" onClick={() => { setAccountForm({ email: user.email, currentPassword: "", newPassword: "" }); setSettingsPage("account"); setSettingsOpen(false); }}><span className="menu-symbol">&#128274;</span>Account and password</button>
          {(workspace?.role === "OWNER" || workspace?.role === "ADMIN") && <>
            <div className="settings-menu-section">{workspace?.name}</div>
            <button className="settings-menu-item" onClick={() => { setSettingsPage("workspace"); setSettingsOpen(false); }}><span className="menu-symbol">&#9638;</span>Workspace settings</button>
            <button className="settings-menu-item" onClick={() => { setShareOpen(true); setSettingsOpen(false); }}><span className="menu-symbol">&#9782;</span>Members<span className="menu-badge">{workspace?.members.length ?? 0}</span></button>
          </>}
          <button className="settings-menu-item" onClick={() => setWorkspaceSwitchOpen((open) => !open)}><span className="menu-symbol">&#8646;</span>Switch workspace<span className="menu-chevron">{workspaceSwitchOpen ? "v" : ">"}</span></button>
          {workspaceSwitchOpen && <div className="workspace-switch-list">{workspaces.filter((item) => item.id !== workspace?.id).map((item) => <button key={item.id} className="settings-menu-item" onClick={() => { setWorkspaceId(item.id); setWorkspaceSwitchOpen(false); setSettingsOpen(false); }}>{item.name}</button>)}{workspaces.length < 2 && <p className="no-other-workspaces">No other workspaces yet.</p>}</div>}
          <div className="settings-menu-section preferences-label">Preferences</div>
          <label className="settings-menu-item menu-select-row"><span className="menu-symbol">&#9681;</span>Theme<select aria-label="Theme" value={theme} onChange={(event) => { const value = event.target.value as "system" | "light" | "dark"; setTheme(value); localStorage.setItem("collab-theme", value); }}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label className="settings-menu-item menu-select-row"><span className="menu-symbol">&#8635;</span>Auto-save versions<select aria-label="Auto-save version interval" value={autoSaveMinutes} onChange={(event) => { const value = Number(event.target.value); setAutoSaveMinutes(value); localStorage.setItem("collab-auto-save-minutes", String(value)); }}><option value={5}>5 min</option><option value={10}>10 min</option><option value={30}>30 min</option></select></label>
          <button className="settings-menu-item logout-menu-item" onClick={() => { setSettingsOpen(false); setLogoutConfirmOpen(true); }}><span className="menu-symbol">&#10162;</span>Log out</button>
        </section>
      </div>}
      {settingsPage && <div className="settings-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setSettingsPage(null); setSettingsError(""); setSettingsFeedback(""); } }}><section className="settings-dialog" role="dialog" aria-modal="true" aria-label={`${settingsPage} settings`}>
        <div className="drawer-heading"><div><p className="eyebrow">{settingsPage === "profile" ? "PERSONAL" : settingsPage === "account" ? "SECURITY" : workspace?.name}</p><h2>{settingsPage === "profile" ? "Profile" : settingsPage === "account" ? "Account and password" : "Workspace settings"}</h2></div><button className="icon-button close-button" aria-label="Close" onClick={() => setSettingsPage(null)}>&times;</button></div>
        {settingsError && <p className="panel-error" role="alert">{settingsError}</p>}{settingsFeedback && <p className="settings-success" role="status">{settingsFeedback}</p>}
        {settingsPage === "profile" && <form className="settings-form" onSubmit={saveProfile}><label>Display name<input required maxLength={80} value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} /></label><label>Avatar image URL<input type="url" placeholder="https://..." value={profileForm.avatarUrl} onChange={(event) => setProfileForm({ ...profileForm, avatarUrl: event.target.value })} /></label><label>Cursor color<input className="cursor-color-input" type="color" value={profileForm.cursorColor} onChange={(event) => setProfileForm({ ...profileForm, cursorColor: event.target.value })} /></label><button className="primary" disabled={busy}>Save profile</button></form>}
        {settingsPage === "account" && <form className="settings-form" onSubmit={saveAccount}><label>Email<input type="email" autoComplete="email" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} /></label><label>Current password<input required type="password" autoComplete="current-password" value={accountForm.currentPassword} onChange={(event) => setAccountForm({ ...accountForm, currentPassword: event.target.value })} /></label><label>New password<input type="password" minLength={12} autoComplete="new-password" placeholder="Leave blank to keep current password" value={accountForm.newPassword} onChange={(event) => setAccountForm({ ...accountForm, newPassword: event.target.value })} /></label><button className="primary" disabled={busy}>Save account</button></form>}
        {settingsPage === "workspace" && <div className="workspace-settings-actions"><p>Manage {workspace?.name} and its pages.</p><button className="settings-action" onClick={() => void renameWorkspace()}>Rename workspace</button>{workspace?.role === "OWNER" && <button className="settings-action danger" onClick={() => void deleteWorkspace()}>Delete workspace</button>}</div>}
      </section></div>}
      {logoutConfirmOpen && <div className="settings-modal-backdrop" role="presentation"><section className="logout-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-confirm-title"><h2 id="logout-confirm-title">Are you sure you want to log out?</h2><p>You can sign in again at any time.</p><div><button className="quiet-button" onClick={() => setLogoutConfirmOpen(false)}>Cancel</button><button className="logout-confirm-yes" onClick={() => { setLogoutConfirmOpen(false); void logout(); }}>Yes</button></div></section></div>}
      <footer className="phase-footer"><span className="status-dot" /> Shared workspace</footer>
    </main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
