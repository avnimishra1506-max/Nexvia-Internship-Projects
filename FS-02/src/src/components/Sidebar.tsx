"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DocumentItem, WorkspaceItem } from "@/types";
import { DEFAULT_USER } from "@/lib/demo-data";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Cpu,
  FilePlus2,
  Settings,
  LayoutDashboard,
} from "lucide-react";

interface SidebarProps {
  workspaces: WorkspaceItem[];
  currentWorkspace: WorkspaceItem;
  onSelectWorkspace: (ws: WorkspaceItem) => void;
  documents: DocumentItem[];
  activeDocumentId: string;
  onSelectDocument: (doc: DocumentItem) => void;
  onCreateDocument: (parentId?: string | null) => void;
  onDeleteDocument: (docId: string) => void;
  onOpenCRDTInspector?: () => void;
  currentUser?: { name: string; avatar?: string | null; cursorColor?: string };
}

export const Sidebar: React.FC<SidebarProps> = ({
  workspaces,
  currentWorkspace,
  onSelectWorkspace,
  documents,
  activeDocumentId,
  onSelectDocument,
  onCreateDocument,
  onDeleteDocument,
  onOpenCRDTInspector,
  currentUser,
}) => {
  const profile = currentUser ?? DEFAULT_USER;
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [expandedDocIds, setExpandedDocIds] = useState<Record<string, boolean>>({
    doc_master_spec: true,
  });

  const toggleExpand = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDocIds((prev) => ({ ...prev, [docId]: !prev[docId] }));
  };

  const renderDocumentTree = (docs: DocumentItem[], level = 0) => {
    return docs.map((doc) => {
      const hasChildren = doc.children && doc.children.length > 0;
      const isExpanded = expandedDocIds[doc.id];
      const isActive = activeDocumentId === doc.id;

      return (
        <div key={doc.id} className="select-none">
          <div
            onClick={() => onSelectDocument(doc)}
            style={{ paddingLeft: `${Math.max(12, level * 16 + 12)}px` }}
            className={`group relative flex items-center justify-between py-1.5 pr-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              isActive
                ? "bg-slate-200/70 text-slate-900 font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {hasChildren ? (
                <button
                  onClick={(e) => toggleExpand(doc.id, e)}
                  className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-3.5" />
              )}
              <span className="text-sm shrink-0">{doc.icon || "📄"}</span>
              <span className="truncate">{doc.title}</span>
            </div>

            {/* Hover actions: add child page or delete */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateDocument(doc.id);
                }}
                title="Add nested sub-page"
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-300/60 rounded"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${doc.title}"?`)) onDeleteDocument(doc.id);
                }}
                title="Delete document"
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Render nested children if expanded */}
          {hasChildren && isExpanded && (
            <div className="mt-0.5">
              {renderDocumentTree(doc.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <aside className="workspace-sidebar w-64 h-screen bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
      {/* Workspace Switcher Header */}
      <div className="relative p-3 border-b border-slate-200/80">
        <button
          onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-200/60 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-base shadow-xs">
              {currentWorkspace.icon}
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-slate-900 truncate">
                {currentWorkspace.name}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {currentWorkspace.role}
              </div>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

        {/* Workspace Dropdown */}
        {workspaceMenuOpen && (
          <div className="absolute top-16 left-3 right-3 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Your Workspaces
            </div>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  onSelectWorkspace(ws);
                  setWorkspaceMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                  ws.id === currentWorkspace.id
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{ws.icon}</span>
                  <span className="truncate">{ws.name}</span>
                </div>
                <span className="text-[10px] uppercase font-mono text-slate-400">{ws.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Navigation / Tools */}
      <div className="p-3 space-y-1 border-b border-slate-200/80">
        <Link
          href="/dashboard"
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200/60 transition-colors"
        >
          <LayoutDashboard className="w-4 h-4 text-slate-500" />
          <span>Dashboard</span>
        </Link>

        {onOpenCRDTInspector && (
          <button
            onClick={onOpenCRDTInspector}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200/60 transition-all shadow-xs"
          >
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span>CRDT Conflict Engine</span>
            <span className="ml-auto text-[9px] bg-indigo-600 text-white px-1.5 py-0.2 rounded-full font-mono">
              Yjs
            </span>
          </button>
        )}

        <button
          onClick={() => onCreateDocument(null)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200/60 transition-colors"
        >
          <FilePlus2 className="w-4 h-4 text-slate-500" />
          <span>New Document</span>
        </button>
      </div>

      {/* Document Hierarchy Section */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="flex items-center justify-between px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Documents & Pages</span>
          <button
            onClick={() => onCreateDocument(null)}
            title="Create root document"
            className="p-1 hover:text-slate-800 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {renderDocumentTree(documents)}
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-100/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.name} className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-xs" />
            ) : (
              <div aria-label={profile.name} className="w-7 h-7 rounded-full bg-indigo-600 text-white ring-2 ring-white shadow-xs flex items-center justify-center text-[10px] font-bold">
                {profile.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 leading-tight">
              {profile.name}
            </div>
            <div className="text-[10px] text-slate-500">{currentWorkspace.role} · Workspace</div>
          </div>
        </div>

        {onOpenCRDTInspector && (
          <button
            onClick={onOpenCRDTInspector}
            title="CRDT Settings & Protocols"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

