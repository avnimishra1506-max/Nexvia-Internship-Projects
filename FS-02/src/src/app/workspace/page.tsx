"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { Editor } from "@/components/Editor";
import { Members } from "@/components/Members";
import { Comments } from "@/components/Comments";
import { VersionHistory } from "@/components/VersionHistory";
import { DEFAULT_USER } from "@/lib/demo-data";
import { DocumentItem, WorkspaceItem, VersionSnapshot } from "@/types";

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([
    {
      id: "ws_default",
      name: "Main Workspace",
      slug: "main-workspace",
      icon: "📁",
      description: "Default team workspace",
      role: "OWNER",
    },
  ]);
  const [currentUser, setCurrentUser] = useState<{ name: string; avatar?: string | null; cursorColor?: string }>(DEFAULT_USER);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceItem>(workspaces[0]);

  const [documents, setDocuments] = useState<DocumentItem[]>([
    {
      id: "doc_1",
      title: "Getting Started",
      icon: "🚀",
      parentDocumentId: null,
      workspaceId: "ws_default",
      createdById: DEFAULT_USER.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userPermission: "EDIT",
      content: "<h1>Welcome to your Collaborative Workspace</h1><p>Type '/' for commands or invite team members to collaborate in real-time.</p>",
      children: [],
    },
  ]);
  const [activeDocument, setActiveDocument] = useState<DocumentItem>(documents[0]);

  useEffect(() => {
    fetch("/api/auth").then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.user) setCurrentUser({ name: data.user.name, avatar: data.user.avatar, cursorColor: data.user.cursorColor });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/workspace").then((r) => r.ok ? r.json() : Promise.reject()).then((data) => {
      if (!data.workspaces?.length) return;
      const selectedId = new URLSearchParams(window.location.search).get("id");
      const chosen = data.workspaces.find((ws: WorkspaceItem) => ws.id === selectedId) ?? data.workspaces[0];
      setWorkspaces(data.workspaces);
      setCurrentWorkspace(chosen);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (currentWorkspace.id === "ws_default") return;
    fetch(`/api/pages?workspaceId=${encodeURIComponent(currentWorkspace.id)}`).then((r) => r.ok ? r.json() : Promise.reject()).then((data) => {
      const pages = data.documents as DocumentItem[];
      setDocuments(pages);
      if (pages.length) {
        const requestedDocumentId = new URLSearchParams(window.location.search).get("documentId");
        setActiveDocument(pages.find((page) => page.id === requestedDocumentId) ?? pages[0]);
      }
    }).catch(() => {});
  }, [currentWorkspace.id]);

  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [restoreRevision, setRestoreRevision] = useState(0);

  const handleCreateDocument = async (parentId: string | null = null) => {
    const response = await fetch("/api/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: currentWorkspace.id, parentDocumentId: parentId }) });
    if (!response.ok) return;
    const { document: newDoc } = await response.json();
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDocument(newDoc);
  };

  const handleDeleteDocument = async (docId: string) => {
    const response = await fetch(`/api/pages?id=${encodeURIComponent(docId)}`, { method: "DELETE" });
    if (!response.ok) return;
    const updated = documents.filter((d) => d.id !== docId);
    setDocuments(updated);
    if (activeDocument.id === docId && updated.length > 0) {
      setActiveDocument(updated[0]);
    }
  };

  const handleUpdateTitle = (newTitle: string) => {
    setActiveDocument((prev) => ({ ...prev, title: newTitle }));
    window.clearTimeout((window as any).__pageSaveTimer);
    (window as any).__pageSaveTimer = window.setTimeout(() => fetch("/api/pages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeDocument.id, title: newTitle }) }), 400);
  };

  const handleUpdateContent = (content: string) => {
    setActiveDocument((prev) => ({ ...prev, content }));
    window.clearTimeout((window as any).__pageSaveTimer);
    (window as any).__pageSaveTimer = window.setTimeout(() => fetch("/api/pages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeDocument.id, content }) }), 700);
  };

  const handleRestoreSnapshot = (_snapshot: VersionSnapshot, restoredDocument?: { title: string; content: string }) => {
    if (!restoredDocument) return;
    setActiveDocument((prev) => ({ ...prev, ...restoredDocument }));
    setDocuments((prev) => prev.map((doc) => doc.id === activeDocument.id ? { ...doc, ...restoredDocument } : doc));
    setRestoreRevision((revision) => revision + 1);
  };

  return (
    <div className="workspace-app flex h-screen w-screen overflow-hidden bg-white text-slate-900">
      <Sidebar
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={setCurrentWorkspace}
        documents={documents}
        activeDocumentId={activeDocument.id}
        onSelectDocument={setActiveDocument}
        onCreateDocument={handleCreateDocument}
        onDeleteDocument={handleDeleteDocument}
        currentUser={currentUser}
      />

      <div className="workspace-main flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar
          workspace={currentWorkspace}
          document={activeDocument}
          onOpenShare={() => setIsMembersOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenComments={() => setIsCommentsOpen(true)}
          unresolvedCommentCount={0}
        />

        <Editor
          document={activeDocument}
          permission={activeDocument.userPermission}
          onUpdateTitle={handleUpdateTitle}
          onUpdateContent={handleUpdateContent}
          restoreRevision={restoreRevision}
        />
      </div>

      <Members
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        documentTitle={activeDocument.title}
        workspaceName={currentWorkspace.name}
        workspaceId={currentWorkspace.id}
        documentId={activeDocument.id}
      />

      <VersionHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        documentTitle={activeDocument.title}
        documentId={activeDocument.id}
        permission={activeDocument.userPermission}
        currentTitle={activeDocument.title}
        currentContent={activeDocument.content}
        onRestoreSnapshot={handleRestoreSnapshot}
      />

      <Comments
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        documentTitle={activeDocument.title}
        documentId={activeDocument.id}
        permission={activeDocument.userPermission}
      />
    </div>
  );
}
