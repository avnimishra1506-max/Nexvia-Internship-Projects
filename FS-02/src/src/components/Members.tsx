"use client";

import React, { useEffect, useState } from "react";
import { PermissionRole, UserProfile } from "@/types";
import { Check, Copy, ShieldCheck, UserPlus, Users, X } from "lucide-react";

interface MembersProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle?: string;
  workspaceName?: string;
  workspaceId?: string;
  documentId?: string;
}

interface MemberRoleItem {
  user: UserProfile;
  role: PermissionRole;
}

export const Members: React.FC<MembersProps> = ({
  isOpen,
  onClose,
  documentTitle = "Shared Document",
  workspaceId,
  documentId,
}) => {
  const [members, setMembers] = useState<MemberRoleItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<PermissionRole>("EDIT");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !documentId) return;
    fetch(`/api/permissions?documentId=${encodeURIComponent(documentId)}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load page permissions");
      setMembers(data.members ?? []);
      setCurrentUserId(data.currentUserId ?? null);
      setError("");
    }).catch((reason) => setError(reason.message));
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRoleChange = async (member: MemberRoleItem, newRole: PermissionRole) => {
    if (!documentId) return;
    const response = await fetch("/api/permissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId, email: member.user.email, role: newRole }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Could not update permission"); return; }
    setMembers((prev) => prev.map((item) => item.user.id === member.user.id ? { ...item, role: newRole } : item));
    setError("");
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !workspaceId || !documentId) return;

    const response = await fetch("/api/workspace/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, email: inviteEmail, role: "VIEWER" }) });
    const data = await response.json();
    if (!response.ok) {
      window.alert(data.error ?? "Could not add member");
      return;
    }

    const permissionResponse = await fetch("/api/permissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId, email: inviteEmail, role: inviteRole }) });
    const permissionData = await permissionResponse.json();
    if (!permissionResponse.ok) { window.alert(permissionData.error ?? "Could not set permission"); return; }
    setMembers((prev) => [...prev.filter((item) => item.user.id !== data.member.user.id), { user: { ...data.member.user, cursorColor: "#6366f1" }, role: inviteRole }]);
    setInviteEmail("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Members & Permissions</h2>
              <p className="text-xs text-slate-500 truncate max-w-[280px]">{documentTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Invite Input Box */}
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter email to invite..."
              className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as PermissionRole)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="EDIT">Can edit</option>
              <option value="COMMENT">Can comment</option>
              <option value="VIEW">Can view</option>
            </select>
            <button
              type="submit"
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite</span>
            </button>
          </form>

          {/* Members list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Workspace Members
              </span>
              <span>{members.length} people</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {members.map((m) => (
                <div
                  key={m.user.id}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                      style={{ backgroundColor: m.user.cursorColor }}
                    >
                      {m.user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                        {m.user.name}
                        {m.user.id === currentUserId && (
                          <span className="text-[10px] font-normal text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{m.user.email}</div>
                    </div>
                  </div>

                  <select
                    value={m.role}
                    disabled={m.user.id === currentUserId}
                    onChange={(e) => handleRoleChange(m, e.target.value as PermissionRole)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium disabled:opacity-50"
                  >
                    <option value="EDIT">Can edit</option>
                    <option value="COMMENT">Can comment</option>
                    <option value="VIEW">Can view</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-500">Permissions apply to this page. Only workspace members can access it.</p>
          {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Copied Link!" : "Copy document link"}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

