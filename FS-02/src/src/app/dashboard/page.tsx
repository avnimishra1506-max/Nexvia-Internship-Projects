"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Check, ChevronDown, Clock3, FilePlus2,
  FileText, FolderOpen, Folders, LayoutGrid, Plus, Search, Share2, Sparkles,
  Star, Users, X,
} from "lucide-react";

interface CurrentUser { id: string; name: string; email: string; avatar: string | null }
interface Workspace {
  id: string; name: string; slug: string; icon?: string | null; description?: string | null;
  role: string; memberCount: number; documentCount: number; updatedAt: string;
}
interface RecentDocument {
  id: string; title: string; icon?: string | null; workspaceId: string; updatedAt: string;
  preview: string; workspace: { name: string; icon?: string | null };
}

type DashboardView = "all" | "shared" | "starred";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<RecentDocument | null>(null);
  const [activeView, setActiveView] = useState<DashboardView>("all");
  const [search, setSearch] = useState("");
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [busy, setBusy] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const loadDashboard = useCallback(async () => {
    setBusy(true);
    const [workspaceResponse, activityResponse] = await Promise.all([
      fetch("/api/workspace"),
      fetch("/api/activity"),
    ]);
    if (workspaceResponse.status === 401 || activityResponse.status === 401) {
      router.replace("/login");
      return;
    }
    const [workspaceData, activityData] = await Promise.all([workspaceResponse.json(), activityResponse.json()]);
    if (!workspaceResponse.ok || !activityResponse.ok) {
      setDataError(workspaceData.error ?? activityData.error ?? "Could not load your workspace data.");
      setBusy(false);
      return;
    }
    const nextWorkspaces = workspaceData.workspaces ?? [];
    const nextDocuments = activityData.documents ?? [];
    setWorkspaces(nextWorkspaces);
    setRecentDocuments(nextDocuments);
    setSelectedDocument((current) => nextDocuments.find((doc: RecentDocument) => doc.id === current?.id) ?? nextDocuments[0] ?? null);
    setDataError("");
    setBusy(false);
  }, [router]);

  useEffect(() => {
    fetch("/api/auth").then(async (response) => {
      if (response.status === 401) { router.replace("/login"); return null; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load your account.");
      setUser(data.user);
      return data.user;
    }).catch((error) => setDataError(error.message)).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    try { setStarredIds(JSON.parse(localStorage.getItem("collabspace-starred") ?? "[]")); } catch { setStarredIds([]); }
  }, []);

  useEffect(() => { if (user) void loadDashboard(); }, [user, loadDashboard]);

  const toggleStar = (id: string) => {
    setStarredIds((previous) => {
      const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
      localStorage.setItem("collabspace-starred", JSON.stringify(next));
      return next;
    });
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    router.push("/login");
  };

  const handleCreateWorkspace = () => { setWorkspaceName(""); setWorkspaceModalOpen(true); };

  const submitWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceName.trim()) return;
    setCreatingWorkspace(true);
    const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: workspaceName.trim() }) });
    const data = await response.json();
    setCreatingWorkspace(false);
    if (!response.ok) { setDataError(data.error ?? "Could not create workspace"); return; }
    router.push(`/workspace?id=${encodeURIComponent(data.workspace.id)}`);
  };

  const handleCreatePage = async () => {
    const workspace = workspaces[0];
    if (!workspace) { await handleCreateWorkspace(); return; }
    const response = await fetch("/api/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: workspace.id, title: "Untitled page" }) });
    const data = await response.json();
    if (!response.ok) { setDataError(data.error ?? "Could not create page"); return; }
    router.push(`/workspace?id=${encodeURIComponent(workspace.id)}&documentId=${encodeURIComponent(data.document.id)}`);
  };

  const openDocument = (doc: RecentDocument) => router.push(`/workspace?id=${encodeURIComponent(doc.workspaceId)}&documentId=${encodeURIComponent(doc.id)}`);

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return recentDocuments.filter((doc) => {
      const matchesSearch = !term || `${doc.title} ${doc.workspace.name} ${doc.preview}`.toLowerCase().includes(term);
      const matchesView = activeView === "all" || (activeView === "shared"
        ? workspaces.some((workspace) => workspace.id === doc.workspaceId && workspace.role !== "OWNER")
        : starredIds.includes(doc.id));
      return matchesSearch && matchesView;
    });
  }, [recentDocuments, search, activeView, workspaces, starredIds]);

  const filteredWorkspaces = useMemo(() => workspaces.filter((workspace) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || `${workspace.name} ${workspace.description ?? ""}`.toLowerCase().includes(term);
    const matchesView = activeView === "all" || (activeView === "shared" ? workspace.role !== "OWNER" : starredIds.includes(workspace.id));
    return matchesSearch && matchesView;
  }), [workspaces, search, activeView, starredIds]);

  if (loading) return <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center text-sm text-slate-500">Loading your workspace…</div>;
  if (!user) return null;

  const initials = user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const pageCount = workspaces.reduce((total, workspace) => total + workspace.documentCount, 0);
  const memberCount = workspaces.reduce((total, workspace) => total + workspace.memberCount, 0);

  return (
    <div className="dashboard-page min-h-screen bg-[#f7f8fa] text-[#202634]">
      <header className="dashboard-header sticky top-0 z-40 h-[68px] border-b border-slate-200/80 bg-white/95 backdrop-blur flex items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-3 w-[230px] shrink-0">
          <img src="/icon.svg" alt="" className="w-9 h-9 rounded-xl shadow-sm" />
          <span className="text-[17px] font-bold tracking-tight">Collab<span className="text-blue-600">Space</span></span>
        </div>
        <label className="hidden md:flex items-center gap-2.5 w-full max-w-[470px] h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
          <Search className="w-4 h-4 shrink-0" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workspaces and pages" className="bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 w-full" />
          {search ? <button aria-label="Clear search" onClick={() => setSearch("")}><X className="w-4 h-4" /></button> : <kbd className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">⌘ K</kbd>}
        </label>
        <div className="flex items-center justify-end gap-2.5 w-[230px] shrink-0">
          <button onClick={handleCreatePage} className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3.5 h-10 rounded-xl shadow-sm shadow-blue-200 transition"><Plus className="w-4 h-4" />New page</button>
          <button onClick={() => void loadDashboard()} title="Refresh workspace data" className="hidden md:grid place-items-center w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-500"><Clock3 className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} /></button>
          <div className="relative group">
            <button className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold ring-2 ring-white shadow-sm">{initials}</button>
            <div className="absolute right-0 top-full mt-2 hidden group-hover:block focus-within:block w-56 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50">
              <div className="px-2 py-2 border-b border-slate-100 mb-1"><p className="text-sm font-semibold truncate">{user.name}</p><p className="text-xs text-slate-500 truncate">{user.email}</p></div>
              <button onClick={handleLogout} className="w-full text-left text-sm px-2 py-2 rounded-lg text-slate-600 hover:bg-slate-50">Sign out</button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto flex min-h-[calc(100vh-68px)]">
        <aside className="dashboard-sidebar hidden lg:flex w-[232px] shrink-0 border-r border-slate-200/80 bg-[#f7f8fa] flex-col px-3 pt-5 pb-4">
          <button className="flex items-center justify-between gap-2 px-2.5 py-2.5 mb-6 rounded-xl hover:bg-white text-left">
            <span className="flex items-center gap-2.5 min-w-0"><span className="grid place-items-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-blue-600"><Folders className="w-4 h-4" /></span><span className="min-w-0"><span className="block text-xs font-semibold truncate">Your workspace</span><span className="block text-[10px] text-slate-500">{workspaces.length} spaces</span></span></span><ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Library</p>
          <SidebarButton active={activeView === "all"} icon={<LayoutGrid className="w-[17px] h-[17px]" />} label="Workspace" onClick={() => setActiveView("all")} count={workspaces.length} />
          <SidebarButton active={activeView === "starred"} icon={<Star className="w-[17px] h-[17px]" />} label="Starred" onClick={() => setActiveView("starred")} count={starredIds.length || undefined} />
          <SidebarButton active={activeView === "shared"} icon={<Share2 className="w-[17px] h-[17px]" />} label="Shared with me" onClick={() => setActiveView("shared")} />
          <div className="my-5 border-t border-slate-200" />
          <div className="flex items-center justify-between px-3 mb-2"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Recent spaces</p><button onClick={handleCreateWorkspace} aria-label="Create workspace" className="text-slate-400 hover:text-blue-600"><Plus className="w-4 h-4" /></button></div>
          <div className="space-y-0.5 overflow-y-auto">
            {workspaces.slice(0, 7).map((workspace) => <button key={workspace.id} onClick={() => router.push(`/workspace?id=${encodeURIComponent(workspace.id)}`)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-white hover:text-slate-900 text-left"><span>{workspace.icon || "📁"}</span><span className="truncate">{workspace.name}</span></button>)}
          </div>
          <div className="mt-auto rounded-2xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold"><span>Library overview</span><span className="text-blue-600">Live</span></div>
            <div className="mt-3 flex items-end gap-1.5"><span className="text-2xl font-bold leading-none">{pageCount}</span><span className="text-[11px] text-slate-500">pages</span></div>
            <p className="mt-2 text-[10px] text-slate-500">Across {workspaces.length} workspaces</p>
          </div>
        </aside>

        <main className="dashboard-main min-w-0 flex-1 px-5 sm:px-7 xl:px-9 py-7">
          {dataError && <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{dataError}</span><button onClick={() => void loadDashboard()} className="font-semibold">Retry</button></div>}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
            <div><div className="text-xs font-semibold text-blue-600 mb-2">{new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</div><h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight">Good {getGreeting()}, {user.name.split(" ")[0]}</h1><p className="mt-1.5 text-sm text-slate-500">Pick up where your team left off.</p></div>
            <button onClick={handleCreateWorkspace} className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:text-blue-700 text-sm font-semibold shadow-sm transition"><Plus className="w-4 h-4" />New workspace</button>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-7">
            <Metric icon={<Folders className="w-4 h-4" />} label="Workspaces" value={workspaces.length} tint="blue" />
            <Metric icon={<FileText className="w-4 h-4" />} label="Pages" value={pageCount} tint="violet" />
            <Metric icon={<Users className="w-4 h-4" />} label="Workspace seats" value={memberCount} tint="green" />
            <Metric icon={<Clock3 className="w-4 h-4" />} label="Recent pages" value={recentDocuments.length} tint="amber" />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-7">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><div><h2 className="text-[15px] font-bold">Continue working</h2><p className="text-xs text-slate-500 mt-0.5">Your team’s latest pages</p></div><button onClick={handleCreatePage} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"><FilePlus2 className="w-3.5 h-3.5" />Create a page</button></div>
            {filteredDocuments.length ? <div className="grid md:grid-cols-2 gap-3 p-4">
              {filteredDocuments.slice(0, 2).map((doc) => <article key={doc.id} onClick={() => setSelectedDocument(doc)} className={`group relative rounded-xl border p-4 transition cursor-pointer ${selectedDocument?.id === doc.id ? "border-blue-300 bg-blue-50/50 ring-2 ring-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"}`}>
                <div className="flex items-start justify-between gap-3"><button onClick={(event) => { event.stopPropagation(); openDocument(doc); }} className="flex items-center gap-2.5 text-left min-w-0"><span className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-slate-200 text-lg">{doc.icon || "📄"}</span><span className="min-w-0"><span className="block text-sm font-semibold truncate group-hover:text-blue-700">{doc.title}</span><span className="block text-[11px] text-slate-500 mt-0.5 truncate">{doc.workspace.icon || "📁"} {doc.workspace.name}</span></span></button><button onClick={(event) => { event.stopPropagation(); toggleStar(doc.id); }} title={starredIds.includes(doc.id) ? "Remove from starred" : "Add to starred"} className={`p-1 rounded-md ${starredIds.includes(doc.id) ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}`}><Star className="w-4 h-4" fill={starredIds.includes(doc.id) ? "currentColor" : "none"} /></button></div>
                <p className="mt-4 min-h-10 text-xs leading-5 text-slate-500 line-clamp-2">{doc.preview || "This page is ready for your next idea."}</p>
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400"><span className="flex items-center gap-1"><Clock3 className="w-3 h-3" />Updated {timeAgo(doc.updatedAt)}</span><ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" /></div>
              </article>)}
            </div> : <div className="p-8 text-center"><div className="mx-auto grid place-items-center w-11 h-11 rounded-2xl bg-blue-50 text-blue-600"><FilePlus2 className="w-5 h-5" /></div><h3 className="mt-3 text-sm font-semibold">Your next page starts here</h3><p className="mt-1 text-xs text-slate-500">Create a page and it will show up here for quick access.</p><button onClick={handleCreatePage} className="mt-4 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">Create your first page</button></div>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100"><div><h2 className="text-[15px] font-bold">{activeView === "starred" ? "Starred pages and spaces" : activeView === "shared" ? "Shared with me" : "Your workspaces"}</h2><p className="text-xs text-slate-500 mt-0.5">Real pages and spaces from your account</p></div><span className="text-xs text-slate-400">{filteredWorkspaces.length} spaces</span></div>
            {filteredWorkspaces.length ? <div className="divide-y divide-slate-100">
              {filteredWorkspaces.map((workspace, index) => {
                const latest = recentDocuments.find((doc) => doc.workspaceId === workspace.id);
                const starred = starredIds.includes(workspace.id);
                return <div key={workspace.id} className="grid grid-cols-[minmax(0,1fr)_110px_120px_110px_28px] items-center gap-3 px-5 py-3.5 hover:bg-slate-50/80 transition">
                  <button onClick={() => router.push(`/workspace?id=${encodeURIComponent(workspace.id)}`)} className="flex items-center gap-3 min-w-0 text-left"><span className={`grid place-items-center w-10 h-10 rounded-xl text-lg ${index % 3 === 0 ? "bg-blue-50" : index % 3 === 1 ? "bg-violet-50" : "bg-amber-50"}`}>{workspace.icon || "📁"}</span><span className="min-w-0"><span className="block text-sm font-semibold truncate hover:text-blue-700">{workspace.name}</span><span className="block text-[11px] text-slate-500 truncate">{latest?.title ?? workspace.description ?? "Workspace pages and files"}</span></span></button>
                  <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500"><FileText className="w-3.5 h-3.5 text-slate-400" />{workspace.documentCount} pages</span>
                  <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-500"><Users className="w-3.5 h-3.5 text-slate-400" />{workspace.memberCount} members</span>
                  <span className="hidden lg:block text-xs text-slate-400">{timeAgo(workspace.updatedAt)}</span>
                  <button onClick={() => toggleStar(workspace.id)} aria-label={starred ? "Unstar workspace" : "Star workspace"} className={`p-1 rounded ${starred ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}`}><Star className="w-4 h-4" fill={starred ? "currentColor" : "none"} /></button>
                </div>;
              })}
            </div> : <div className="px-5 py-12 text-center"><FolderOpen className="w-7 h-7 mx-auto text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">Nothing to show here yet</p><p className="mt-1 text-xs text-slate-500">Create a workspace or star an existing page to see it here.</p></div>}
          </section>
          <p className="mt-5 text-[11px] text-slate-400 flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-500" />Your workspaces and pages are saved to your account.</p>
        </main>

        <aside className="hidden 2xl:block w-[330px] shrink-0 border-l border-slate-200/80 bg-white px-5 py-7">
          <div className="flex items-center justify-between mb-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Quick preview</p><h2 className="mt-1 text-sm font-bold">{selectedDocument?.title ?? "Your workspace"}</h2></div><Sparkles className="w-4 h-4 text-blue-500" /></div>
          {selectedDocument ? <>
            <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] p-4 min-h-40"><div className="text-3xl mb-4">{selectedDocument.icon || "📄"}</div><p className="text-sm font-semibold leading-5">{selectedDocument.title}</p><p className="mt-2 text-xs leading-5 text-slate-500">{selectedDocument.preview || "No page preview yet. Open the document to start writing."}</p></div>
            <button onClick={() => openDocument(selectedDocument)} className="mt-3 w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">Open page <ArrowRight className="w-3.5 h-3.5" /></button>
            <div className="mt-7"><h3 className="text-xs font-bold text-slate-700">Page details</h3><div className="mt-3 space-y-3 text-xs"><Detail label="Workspace" value={selectedDocument.workspace.name} /><Detail label="Last updated" value={new Date(selectedDocument.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} /><Detail label="Access" value="Workspace members" /></div></div>
          </> : <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center"><div className="mx-auto grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600"><Folders className="w-5 h-5" /></div><p className="mt-3 text-sm font-semibold">Build your team space</p><p className="mt-1 text-xs leading-5 text-slate-500">Create a workspace, add pages, and invite teammates to collaborate.</p><button onClick={handleCreateWorkspace} className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700">Create workspace <ArrowRight className="inline w-3.5 h-3.5 ml-1" /></button></div>}

            <div className="mt-8 rounded-2xl bg-gradient-to-br from-[#edf4ff] to-[#f6f2ff] border border-blue-100/80 p-4"><div className="flex items-center gap-2 text-blue-700"><Share2 className="w-4 h-4" /><span className="text-xs font-bold">Live collaboration</span></div><p className="mt-2 text-xs leading-5 text-slate-600">Open a page with a teammate to edit together, comment, and keep a version history.</p><button onClick={() => selectedDocument && openDocument(selectedDocument)} className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">Explore a page <ArrowRight className="w-3 h-3" /></button></div>
        </aside>
      </div>

      {workspaceModalOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 backdrop-blur-sm p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setWorkspaceModalOpen(false); }}>
        <form onSubmit={submitWorkspace} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-blue-600">New space</p><h2 className="mt-1 text-xl font-bold tracking-tight">Create a workspace</h2><p className="mt-1 text-sm text-slate-500">Give your team a place to organize pages and ideas.</p></div><button type="button" onClick={() => setWorkspaceModalOpen(false)} aria-label="Close" className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
          <label className="block mt-5 text-xs font-semibold text-slate-700">Workspace name<input autoFocus value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="e.g. Product team" className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
          <div className="flex justify-end gap-2 mt-6"><button type="button" onClick={() => setWorkspaceModalOpen(false)} className="h-10 px-4 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button disabled={!workspaceName.trim() || creatingWorkspace} className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">{creatingWorkspace ? "Creating…" : "Create workspace"}</button></div>
        </form>
      </div>}
    </div>
  );
}

function SidebarButton({ active, icon, label, count, onClick }: { active: boolean; icon: ReactNode; label: string; count?: number; onClick: () => void }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition ${active ? "bg-white text-blue-700 shadow-sm border border-slate-200/70" : "text-slate-600 hover:bg-white/80"}`}><span className={active ? "text-blue-600" : "text-slate-400"}>{icon}</span><span className="flex-1 text-left">{label}</span>{typeof count === "number" && count > 0 && <span className="text-[10px] text-slate-400">{count}</span>}</button>;
}

function Metric({ icon, label, value, tint }: { icon: ReactNode; label: string; value: number; tint: "blue" | "violet" | "green" | "amber" }) {
  const colors = { blue: "bg-blue-50 text-blue-600", violet: "bg-violet-50 text-violet-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600" };
  return <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"><span className={`grid place-items-center w-9 h-9 rounded-xl ${colors[tint]}`}>{icon}</span><span><span className="block text-[10px] text-slate-500">{label}</span><span className="block mt-0.5 text-lg font-bold leading-none">{value}</span></span></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-slate-400">{label}</span><span className="text-slate-700 font-medium text-right truncate">{value}</span></div>;
}

function getGreeting() { const hour = new Date().getHours(); return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"; }
function timeAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}
