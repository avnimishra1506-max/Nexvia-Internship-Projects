"use client";

import React from "react";
import Link from "next/link";
import { DocumentItem, WorkspaceItem } from "@/types";
import {
  Share2,
  History,
  MessageSquare,
  Cpu,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";

interface NavbarProps {
  workspace: WorkspaceItem;
  document?: DocumentItem;
  onOpenShare?: () => void;
  onOpenHistory?: () => void;
  onOpenComments?: () => void;
  onOpenCRDTInspector?: () => void;
  unresolvedCommentCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  workspace,
  document,
  onOpenShare,
  onOpenHistory,
  onOpenComments,
  onOpenCRDTInspector,
  unresolvedCommentCount = 0,
}) => {
  return (
    <header className="workspace-navbar h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0 z-20">
      {/* Breadcrumb Navigation (Notion style) */}
      <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Go to Dashboard"
        >
          <LayoutDashboard className="w-4 h-4" />
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />

        <Link
          href={`/workspace/${workspace.id}`}
          className="flex items-center gap-1 font-medium text-slate-700 hover:text-indigo-600 transition-colors truncate max-w-[140px]"
        >
          <span>{workspace.icon}</span>
          <span>{workspace.name}</span>
        </Link>

        {document && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="flex items-center gap-1 font-semibold text-slate-900 truncate max-w-[220px]">
              <span>{document.icon}</span>
              <span>{document.title}</span>
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Editor shows live connection state and the peers actually in this room. */}
        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
          {onOpenCRDTInspector && (
            <button
              onClick={onOpenCRDTInspector}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-all shadow-xs"
              title="CRDT Conflict-Resolution Inspector (Step 1)"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">CRDT Math</span>
            </button>
          )}

          {onOpenComments && (
            <button
              onClick={onOpenComments}
              className="relative p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Open Comments"
            >
              <MessageSquare className="w-4 h-4" />
              {unresolvedCommentCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                  {unresolvedCommentCount}
                </span>
              )}
            </button>
          )}

          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Version History & Snapshots (Step 6)"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          {onOpenShare && (
            <button
              onClick={onOpenShare}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 ml-1"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

