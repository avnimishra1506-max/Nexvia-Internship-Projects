"use client";

import React, { useEffect, useState } from "react";
import { PermissionRole, VersionSnapshot } from "@/types";
import { History, RotateCcw, Clock, Plus, CheckCircle, Database, X } from "lucide-react";

interface VersionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle?: string;
  documentId: string;
  permission: PermissionRole;
  currentTitle: string;
  currentContent?: string;
  onRestoreSnapshot?: (snapshot: VersionSnapshot, restoredDocument?: { title: string; content: string }) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  isOpen,
  onClose,
  documentTitle = "Document",
  documentId,
  permission,
  currentTitle,
  currentContent,
  onRestoreSnapshot,
}) => {
  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<VersionSnapshot | null>(null);
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !documentId) return;
    fetch(`/api/versions?documentId=${encodeURIComponent(documentId)}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load snapshots");
      setSnapshots(data.snapshots ?? []);
      setSelectedSnapshot(data.snapshots?.[0] ?? null);
      setError("");
    }).catch((reason) => setError(reason.message));
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handleRestore = async (snap: VersionSnapshot) => {
    const response = await fetch("/api/versions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshotId: snap.id }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Could not restore version"); return; }
    setRestoredId(snap.id);
    if (onRestoreSnapshot) {
      onRestoreSnapshot(snap, { title: data.document.title, content: data.document.content ?? "" });
    }
    setTimeout(() => {
      setRestoredId(null);
      onClose();
    }, 1200);
  };

  const handleCreateSnapshot = async () => {
    const response = await fetch("/api/versions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId, title: currentTitle, content: currentContent, description: "Manual snapshot" }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Could not create snapshot"); return; }
    setSnapshots((prev) => [data.snapshot, ...prev]);
    setSelectedSnapshot(data.snapshot);
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Version History & Snapshots</h2>
              <p className="text-xs text-slate-500">{documentTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {permission === "EDIT" && <button
              onClick={handleCreateSnapshot}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Snapshot</span>
            </button>}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && <div role="alert" className="px-6 py-2 text-xs text-rose-700 bg-rose-50">{error}</div>}

        {/* Content Body: Two columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left column: List of snapshots */}
          <div className="w-1/2 border-r border-slate-100 p-4 overflow-y-auto space-y-2 bg-slate-50/50">
            {snapshots.map((snap) => {
              const isSelected = selectedSnapshot?.id === snap.id;
              return (
                <div
                  key={snap.id}
                  onClick={() => setSelectedSnapshot(snap)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? "bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500/20"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
                        v{snap.versionNumber}
                      </span>
                      {snap.title}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(snap.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">{snap.description}</p>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-600 font-medium">{snap.createdBy.name}</span>
                    <span className="font-mono text-slate-400">{snap.stateVectorSummary?.split("|")[1] || "CRDT State"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right column: Selected Snapshot Details & Rollback */}
          <div className="w-1/2 p-6 flex flex-col justify-between bg-white">
            {selectedSnapshot ? (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Snapshot Details</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                      Version {selectedSnapshot.versionNumber}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedSnapshot.title}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{selectedSnapshot.description}</p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Database className="w-3.5 h-3.5 text-indigo-600" />
                      <span>CRDT State Vector Metadata</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                      {selectedSnapshot.stateVectorSummary}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Captured at: {new Date(selectedSnapshot.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={onClose}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Close
                  </button>

                  {permission === "EDIT" && <button
                    onClick={() => handleRestore(selectedSnapshot)}
                    disabled={restoredId === selectedSnapshot.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:bg-emerald-600"
                  >
                    {restoredId === selectedSnapshot.id ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Restored!</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>Restore to this version</span>
                      </>
                    )}
                  </button>}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400">
                <Clock className="w-8 h-8 text-slate-300 mb-2" />
                <p>No snapshots yet. Click &quot;Snapshot&quot; to save a checkpoint.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

