"use client";

import React from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Sparkles,
} from "lucide-react";

interface ToolbarProps {
  onFormat?: (type: string) => void;
  canEdit?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onFormat, canEdit = true }) => {
  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium mb-4">
        <span>🔒 View-Only Mode: You have read-only access to this document.</span>
      </div>
    );
  }

  const buttons = [
    { label: "Bold", icon: Bold, action: "bold" },
    { label: "Italic", icon: Italic, action: "italic" },
    { label: "Strike", icon: Strikethrough, action: "strike" },
    { label: "Code", icon: Code, action: "code" },
    { divider: true },
    { label: "H1", icon: Heading1, action: "h1" },
    { label: "H2", icon: Heading2, action: "h2" },
    { label: "H3", icon: Heading3, action: "h3" },
    { divider: true },
    { label: "Bullet List", icon: List, action: "bulletList" },
    { label: "Numbered List", icon: ListOrdered, action: "orderedList" },
    { label: "Quote", icon: Quote, action: "blockquote" },
  ];

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-1 p-1.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xs mb-6">
      <div className="flex items-center gap-1 overflow-x-auto">
        {buttons.map((btn, idx) => {
          if (btn.divider) {
            return <div key={idx} className="w-[1px] h-4 bg-slate-200 mx-1" />;
          }

          const IconComponent = btn.icon!;
          return (
            <button
              key={btn.action}
              onClick={() => onFormat?.(btn.action!)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-100 active:scale-95 transition-all"
              title={btn.label}
            >
              <IconComponent className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
        <button
          onClick={() => onFormat?.("ai-refine")}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>AI Assist</span>
        </button>
      </div>
    </div>
  );
};

