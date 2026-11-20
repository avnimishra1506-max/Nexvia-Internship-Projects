"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import type { WebsocketProvider } from "y-websocket";
import type { Doc } from "yjs";
import { DocumentItem, PermissionRole } from "@/types";
import { createWebsocketProvider, createYjsDoc } from "@/lib/yjs";
import { Toolbar } from "./Toolbar";
import { Image as ImageIcon, Wifi, WifiOff, Heading, List, Quote, Code2 } from "lucide-react";

interface EditorProps {
  document: DocumentItem;
  permission?: PermissionRole;
  onUpdateTitle?: (newTitle: string) => void;
  onUpdateContent?: (newContent: string) => void;
  restoreRevision?: number;
}

type CollaborationSession = { doc: Doc; provider: WebsocketProvider };
type OnlineUser = { clientId: number; name: string; color: string };

export const Editor: React.FC<EditorProps> = ({ document, permission = "EDIT", onUpdateTitle, onUpdateContent, restoreRevision = 0 }) => {
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [connection, setConnection] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [title, setTitle] = useState(document.title);
  const [showCover, setShowCover] = useState(Boolean(document.coverImage));
  const [coverUrl, setCoverUrl] = useState(document.coverImage || "");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ x: 0, y: 0 });
  const [wordCount, setWordCount] = useState(0);
  const [collaborator, setCollaborator] = useState({ name: "Collaborator", color: "#6366f1" });
  const lastRestoreRevision = useRef(restoreRevision);
  const canEdit = permission === "EDIT";

  useEffect(() => {
    let active = true;
    const ydoc = createYjsDoc(`document:${document.id}`);
    const provider = createWebsocketProvider(`document:${document.id}`, ydoc);
    if (!provider) {
      ydoc.destroy();
      setConnection("disconnected");
      return;
    }
    setConnection("connecting");
    const onStatus = ({ status }: { status: string }) => active && setConnection(status === "connected" ? "connected" : status === "disconnected" ? "disconnected" : "connecting");
    provider.on("status", onStatus);
    setSession({ doc: ydoc, provider });

    fetch("/api/auth").then((response) => response.ok ? response.json() : null).then((data) => {
      if (!active || !data?.user) return;
      const color = data.user.cursorColor || "#6366f1";
      const user = { name: data.user.name, color };
      setCollaborator(user);
      provider.awareness.setLocalStateField("user", user);
    }).catch(() => {});

    return () => {
      active = false;
      provider.off("status", onStatus);
      provider.destroy();
      ydoc.destroy();
      setSession((current) => current?.doc === ydoc ? null : current);
    };
  }, [document.id]);

  useEffect(() => {
    if (!session) return;
    const updateOnlineUsers = () => {
      const users = Array.from(session.provider.awareness.getStates().entries()).flatMap(([clientId, state]) => {
        const user = (state as { user?: { name?: string; color?: string } }).user;
        return user?.name ? [{ clientId, name: user.name, color: user.color || "#6366f1" }] : [];
      });
      setOnlineUsers(users);
    };
    session.provider.awareness.on("change", updateOnlineUsers);
    updateOnlineUsers();
    return () => { session.provider.awareness.off("change", updateOnlineUsers); };
  }, [session]);

  const extensions = useMemo(() => {
    const base = StarterKit.configure({ history: false });
    if (!session) return [base];
    return [
      base,
      Collaboration.configure({ document: session.doc }),
      CollaborationCursor.configure({ provider: session.provider, user: collaborator }),
    ];
  }, [session, collaborator]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    editable: canEdit,
    content: "",
    editorProps: {
      attributes: { class: "ProseMirror prose prose-slate max-w-none text-slate-800 leading-relaxed focus:outline-none min-h-[500px]", "data-placeholder": "Press '/' for commands, or start typing..." },
      handleKeyDown: (_view, event) => {
        if (event.key === "/" && canEdit) {
          const selection = window.getSelection();
          if (selection?.rangeCount) {
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            setSlashMenuPos({ x: rect.left, y: rect.bottom + 8 });
            setShowSlashMenu(true);
          }
        } else if (event.key === "Escape") setShowSlashMenu(false);
        return false;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const text = currentEditor.getText();
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
      onUpdateContent?.(currentEditor.getHTML());
    },
  }, [document.id, session, canEdit, collaborator]);

  useEffect(() => {
    setTitle(document.title);
    setShowCover(Boolean(document.coverImage));
    setCoverUrl(document.coverImage || "");
  }, [document.id, document.title, document.coverImage]);

  useEffect(() => {
    if (!session || !editor) return;
    const onSync = (synced: boolean) => {
      if (!synced) return;
      setConnection("connected");
      // Seed a new shared room once it has synchronized with the server.
      // Existing rooms keep their CRDT state; saved HTML is only a fallback.
      if (session.doc.getXmlFragment("default").length === 0 && document.content) {
        editor.commands.setContent(document.content, false);
      }
      const initialText = editor.getText();
      setWordCount(initialText.trim() ? initialText.trim().split(/\s+/).length : 0);
    };
    session.provider.on("sync", onSync);
    if (session.provider.synced) onSync(true);
    return () => { session.provider.off("sync", onSync); };
  }, [session, editor, document.id, document.content]);

  useEffect(() => {
    if (!editor || !session || restoreRevision === lastRestoreRevision.current) return;
    lastRestoreRevision.current = restoreRevision;
    editor.commands.setContent(document.content || "", false);
    const text = editor.getText();
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
  }, [restoreRevision, editor, session, document.content]);

  useEffect(() => {
    editor?.setEditable(canEdit);
  }, [editor, canEdit]);

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    setTitle(event.target.value);
    onUpdateTitle?.(event.target.value);
  };

  const handleFormat = (type: string) => {
    if (!editor || !canEdit) return;
    const chain = editor.chain().focus();
    switch (type) {
      case "bold": chain.toggleBold().run(); break;
      case "italic": chain.toggleItalic().run(); break;
      case "strike": chain.toggleStrike().run(); break;
      case "code": chain.toggleCode().run(); break;
      case "h1": chain.toggleHeading({ level: 1 }).run(); break;
      case "h2": chain.toggleHeading({ level: 2 }).run(); break;
      case "h3": chain.toggleHeading({ level: 3 }).run(); break;
      case "bulletList": chain.toggleBulletList().run(); break;
      case "orderedList": chain.toggleOrderedList().run(); break;
      case "blockquote": chain.toggleBlockquote().run(); break;
    }
  };

  const insertBlock = (tag: string) => {
    setShowSlashMenu(false);
    if (!editor || !canEdit) return;
    if (tag === "h1" || tag === "h2") editor.chain().focus().toggleHeading({ level: tag === "h1" ? 1 : 2 }).run();
    else if (tag === "ul") editor.chain().focus().toggleBulletList().run();
    else if (tag === "blockquote") editor.chain().focus().toggleBlockquote().run();
    else editor.chain().focus().toggleCodeBlock().run();
  };

  return (
    <div className="workspace-editor relative flex-1 bg-white min-h-screen pb-32 overflow-y-auto selection:bg-indigo-100 selection:text-indigo-900">
      {showCover && coverUrl && <div className="group relative w-full h-48 md:h-64 overflow-hidden bg-slate-100"><img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />{canEdit && <button onClick={() => { const next = prompt("Enter new image cover URL:", coverUrl); if (next) setCoverUrl(next); }} className="absolute right-4 bottom-4 px-3 py-1.5 bg-black/60 text-white text-xs rounded-lg">Change Cover</button>}</div>}
      <div className="max-w-4xl mx-auto px-6 md:px-12 pt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3"><div className="text-4xl p-1">{document.icon || "📄"}</div>{canEdit && !showCover && <button onClick={() => { setShowCover(true); setCoverUrl("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1400&auto=format&fit=crop&q=80"); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg"><ImageIcon className="w-3.5 h-3.5" />Add cover</button>}</div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className={`flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-full ${connection === "connected" ? "text-emerald-600 bg-emerald-50" : connection === "connecting" ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50"}`}>
              {connection === "connected" ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{connection === "connected" ? "Yjs: Connected" : connection === "connecting" ? "Yjs: Connecting" : "Yjs: Offline"}</span>
            </span>
            {connection === "connected" && <div className="flex items-center gap-1.5" aria-label={`${onlineUsers.length} users online`}>
              <div className="flex items-center -space-x-1.5">
                {onlineUsers.slice(0, 4).map((user) => <span key={user.clientId} title={`${user.name} is online`} className="w-6 h-6 rounded-full border-2 border-white text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: user.color }}>{user.name.slice(0, 2).toUpperCase()}</span>)}
                {onlineUsers.length > 4 && <span className="w-6 h-6 rounded-full border-2 border-white bg-slate-500 text-white text-[9px] flex items-center justify-center">+{onlineUsers.length - 4}</span>}
              </div>
              <span className="text-[11px] text-slate-500 whitespace-nowrap">{onlineUsers.length} online</span>
            </div>}
            <span>{wordCount} words</span>
          </div>
        </div>
        <input type="text" value={title} readOnly={!canEdit} onChange={handleTitleChange} placeholder="Untitled" className="w-full text-3xl md:text-4xl font-extrabold text-slate-900 border-none outline-none focus:ring-0 placeholder:text-slate-300 bg-transparent mb-4 tracking-tight" />
        <Toolbar onFormat={handleFormat} canEdit={canEdit} />
        {editor ? <EditorContent editor={editor} /> : <div className="min-h-[500px] text-sm text-slate-400">Connecting to this document…</div>}
      </div>
      {showSlashMenu && <div className="fixed z-50 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 space-y-1" style={{ top: Math.min(window.innerHeight - 280, slashMenuPos.y), left: Math.min(window.innerWidth - 280, slashMenuPos.x) }}>
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Basic Blocks</div>
        <button onClick={() => insertBlock("h1")} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-100 rounded"><Heading className="w-4 h-4" />Heading 1</button>
        <button onClick={() => insertBlock("h2")} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-100 rounded"><Heading className="w-4 h-4" />Heading 2</button>
        <button onClick={() => insertBlock("ul")} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-100 rounded"><List className="w-4 h-4" />Bullet list</button>
        <button onClick={() => insertBlock("blockquote")} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-100 rounded"><Quote className="w-4 h-4" />Quote</button>
        <button onClick={() => insertBlock("code")} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-100 rounded"><Code2 className="w-4 h-4" />Code block</button>
      </div>}
    </div>
  );
};
