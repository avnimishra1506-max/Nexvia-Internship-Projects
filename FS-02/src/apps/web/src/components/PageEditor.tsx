import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import { VersionHistoryPanel } from "./PageExtras";

type Props = { pageId: string; userId: string; userName: string; userCursorColor?: string; editable: boolean; historyOpen: boolean; onHistoryClose: () => void; autoSaveMinutes: number };
type LocalDoc = { doc: Y.Doc; persistence: IndexeddbPersistence | null };

const WS_URL = (import.meta as ImportMeta & { env: { VITE_WS_URL?: string } }).env.VITE_WS_URL
  ?? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:1234`;

function cursorColor(userId: string, preferred?: string): string {
  if (preferred && /^#[0-9a-fA-F]{6}$/.test(preferred)) return preferred;
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const colors = ["#b44352", "#3469a8", "#8053a6", "#27826c", "#b26d26", "#387d9c"];
  return colors[Math.abs(hash) % colors.length];
}

function safeWebUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

export function PageEditor({ pageId, userId, userName, userCursorColor, editable, historyOpen, onHistoryClose, autoSaveMinutes }: Props) {
  const [local, setLocal] = useState<LocalDoc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [serverSynced, setServerSynced] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");
  const [saveState, setSaveState] = useState("Starting local editor…");
  const saveTimer = useRef<number | undefined>(undefined);
  const lastActivity = useRef(Date.now());
  const lastVersionSignature = useRef("");
  const versionSaving = useRef(false);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  useEffect(() => {
    let active = true;
    const doc = new Y.Doc();
    let persistence: IndexeddbPersistence | undefined;
    try {
      persistence = new IndexeddbPersistence(`collab-workspace:${userId}:${pageId}`, doc);
      persistence.once("synced", () => {
        if (!active) return;
        setLocal({ doc, persistence: persistence ?? null });
        setSaveState("Saved in this browser");
        setReady(true);
      });
      persistence.on("error", (error: unknown) => {
        if (!active) return;
        setStorageWarning(error instanceof Error ? error.message : "Browser storage is unavailable.");
        persistence?.destroy();
        setLocal({ doc, persistence: null });
        setReady(true);
      });
    } catch (error) {
      if (active) {
        setStorageWarning(error instanceof Error ? error.message : "Browser storage is unavailable.");
        setLocal({ doc, persistence: null });
        setReady(true);
      }
    }
    return () => {
      active = false;
      persistence?.destroy();
      doc.destroy();
    };
  }, [pageId, userId]);

  useEffect(() => {
    if (!local) return;
    const nextProvider = new WebsocketProvider(WS_URL, `page:${pageId}`, local.doc);
    const handleStatus = ({ status }: { status: string }) => setConnectionStatus(status);
    const handleSync = (synced: boolean) => setServerSynced(synced);
    nextProvider.on("status", handleStatus);
    nextProvider.on("sync", handleSync);
    setProvider(nextProvider);
    setConnectionStatus("connecting");
    setServerSynced(false);
    return () => {
      nextProvider.off("status", handleStatus);
      nextProvider.off("sync", handleSync);
      nextProvider.destroy();
      setProvider((current) => current === nextProvider ? null : current);
    };
  }, [local, pageId]);

  const extensions = useMemo(() => {
    return [
      StarterKit.configure({ history: false }),
      ...(provider ? [
        Collaboration.configure({ document: provider.doc, field: "default" }),
        CollaborationCursor.configure({ provider, user: { name: userName, color: cursorColor(userId, userCursorColor) } }),
      ] : []),
      Placeholder.configure({ placeholder: "Start writing…" }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow" } }),
      Image.configure({ allowBase64: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ];
  }, [provider, userId, userName, userCursorColor]);

  const editor = useEditor({
    extensions,
    editable,
    editorProps: { attributes: { class: "tiptap-content", "aria-label": "Page editor" } },
    onUpdate: () => {
      lastActivity.current = Date.now();
      setSaveState("Saving locally…");
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => setSaveState("Saved in this browser"), 500);
    },
  }, [provider, editable, userName, userCursorColor]);

  useEffect(() => {
    if (!editor || !ready || !local || !provider || !serverSynced) return;
    if (local.doc.getXmlFragment("default").length === 0) {
      editor.commands.setContent("<p>Welcome to your page. Start writing, or use the toolbar to format your notes.</p>");
    }
  }, [editor, ready, local, provider, serverSynced]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const href = safeWebUrl(window.prompt("Paste a web link (https:// or http://)"));
    if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const src = safeWebUrl(window.prompt("Paste an image URL (https:// or http://)"));
    if (src) editor.chain().focus().setImage({ src, alt: "" }).run();
  }, [editor]);

  const getSnapshot = useCallback(() => editor?.getJSON() ?? {}, [editor]);
  const restoreSnapshot = useCallback((snapshot: unknown) => {
    if (editor && typeof snapshot === "object" && snapshot !== null) editor.commands.setContent(snapshot as JSONContent);
  }, [editor]);

  const markVersionSaved = useCallback(() => {
    lastVersionSignature.current = JSON.stringify(editor?.getJSON() ?? {});
    lastActivity.current = Date.now();
  }, [editor]);

  useEffect(() => {
    if (!editor || !editable || !ready || !serverSynced) return;
    if (!lastVersionSignature.current) lastVersionSignature.current = JSON.stringify(editor.getJSON());
    const timer = window.setInterval(async () => {
      if (versionSaving.current || Date.now() - lastActivity.current < autoSaveMinutes * 60_000) return;
      const snapshot = editor.getJSON();
      const signature = JSON.stringify(snapshot);
      if (signature === lastVersionSignature.current) return;
      versionSaving.current = true;
      try {
        const apiBase = (import.meta as ImportMeta & { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "http://localhost:4000";
        const response = await fetch(`${apiBase}/api/pages/${pageId}/versions`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshot, description: "Auto-saved" }) });
        if (response.ok) lastVersionSignature.current = signature;
      } catch {
        // Retry on the next interval while the editor remains idle.
      } finally { versionSaving.current = false; }
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [editor, editable, ready, serverSynced, pageId, autoSaveMinutes]);

  if (!ready || !editor) return <div className="editor-loading"><span className="spinner" />Opening this page on this device…</div>;

  return <section className="rich-editor" aria-label="Rich text editor">
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      <button type="button" title="Paragraph" aria-label="Paragraph" className={editor.isActive("paragraph") ? "active" : ""} onClick={() => editor.chain().focus().setParagraph().run()}>¶</button>
      <button type="button" title="Heading 1" aria-label="Heading 1" className={editor.isActive("heading", { level: 1 }) ? "active" : ""} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
      <button type="button" title="Heading 2" aria-label="Heading 2" className={editor.isActive("heading", { level: 2 }) ? "active" : ""} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <span className="toolbar-divider" />
      <button type="button" title="Bold" aria-label="Bold" className={editor.isActive("bold") ? "active" : ""} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></button>
      <button type="button" title="Italic" aria-label="Italic" className={editor.isActive("italic") ? "active" : ""} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></button>
      <button type="button" title="Bullet list" aria-label="Bullet list" className={editor.isActive("bulletList") ? "active" : ""} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
      <button type="button" title="Numbered list" aria-label="Numbered list" className={editor.isActive("orderedList") ? "active" : ""} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
      <button type="button" title="Task list" aria-label="Task list" className={editor.isActive("taskList") ? "active" : ""} onClick={() => editor.chain().focus().toggleTaskList().run()}>☑ Tasks</button>
      <span className="toolbar-divider" />
      <button type="button" title="Link" aria-label="Insert link" className={editor.isActive("link") ? "active" : ""} onClick={addLink}>↗ Link</button>
      <button type="button" title="Image" aria-label="Insert image" onClick={addImage}>▧ Image</button>
      <button type="button" title="Insert table" aria-label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦ Table</button>
      <button type="button" title="Quote" aria-label="Quote" className={editor.isActive("blockquote") ? "active" : ""} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❞</button>
      <button type="button" title="Code block" aria-label="Code block" className={editor.isActive("codeBlock") ? "active" : ""} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>&lt;/&gt;</button>
    </div>
    {storageWarning && <p className="storage-warning" role="status">Browser storage is unavailable; this page will only remain until you close or refresh this tab.</p>}
    <EditorContent editor={editor} />
      <div className="editor-status"><span className={`local-status-dot ${connectionStatus === "connected" ? "connected" : "offline"}`} />{saveState}<span className="status-separator">·</span>{editable ? (connectionStatus === "connected" ? "Live with your team" : "Reconnecting to live editing…") : "View only"}</div>
      <VersionHistoryPanel pageId={pageId} canEdit={editable} open={historyOpen} onClose={onHistoryClose} onSaved={markVersionSaved} getSnapshot={getSnapshot} restoreSnapshot={restoreSnapshot} />
  </section>;
}
