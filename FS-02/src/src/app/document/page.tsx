"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { Editor } from "@/components/Editor";
import { Members } from "@/components/Members";
import { Comments } from "@/components/Comments";
import { VersionHistory } from "@/components/VersionHistory";
import { DEFAULT_USER } from "@/lib/demo-data";
import { DocumentItem, WorkspaceItem, VersionSnapshot } from "@/types";

export default function DocumentPage() {
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
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceItem>(workspaces[0]);

  const [documents, setDocuments] = useState<DocumentItem[]>([
    {
      id: "doc_1",
      title: "Untitled Document",
      icon: "📄",
      parentDocumentId: null,
      workspaceId: "ws_default",
      createdById: DEFAULT_USER.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userPermission: "EDIT",
      content: "<h1>Untitled Document</h1><p>Start writing here...</p>",
      children: [],
    },
  ]);
  const [activeDocument, setActiveDocument] = useState<DocumentItem>(documents[0]);

  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const handleCreateDocument = (parentId: string | null = null) => {
    const newDocId = `doc_${Date.now()}`;
    const newDoc: DocumentItem = {
      id: newDocId,
      title: "New Document",
      icon: "📄",
      parentDocumentId: parentId,
      workspaceId: currentWorkspace.id,
      createdById: DEFAULT_USER.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userPermission: "EDIT",
      content: "<h1>New Document</h1><p>Start typing...</p>",
      children: [],
    };

    setDocuments([newDoc, ...documents]);
    setActiveDocument(newDoc);
  };

  const handleDeleteDocument = (docId: string) => {
    const updated = documents.filter((d) => d.id !== docId);
    setDocuments(updated);
    if (activeDocument.id === docId && updated.length > 0) {
      setActiveDocument(updated[0]);
    }
  };

  const handleUpdateTitle = (newTitle: string) => {
    setActiveDocument((prev) => ({ ...prev, title: newTitle }));
  };

  const handleRestoreSnapshot = (snapshot: VersionSnapshot) => {
    setActiveDocument((prev) => ({
      ...prev,
      title: `${prev.title} (Restored from v${snapshot.versionNumber})`,
    }));
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
