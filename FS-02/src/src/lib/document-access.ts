import { prisma } from "@/lib/prisma";
import type { PermissionRole, WorkspaceRole } from "@/types";

export async function getDocumentAccess(documentId: string, userId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      workspaceId: true,
      workspace: { select: { members: { where: { userId }, select: { role: true } } } },
      permissions: { where: { userId }, select: { role: true } },
    },
  });
  const workspaceRole = document?.workspace.members[0]?.role as WorkspaceRole | undefined;
  if (!document || !workspaceRole) return null;
  const permission = (document.permissions[0]?.role ?? (workspaceRole === "VIEWER" ? "VIEW" : "EDIT")) as PermissionRole;
  return { documentId, workspaceId: document.workspaceId, workspaceRole, permission };
}

export function canReadDocument(permission: PermissionRole) {
  return permission === "VIEW" || permission === "COMMENT" || permission === "EDIT";
}

export function canCommentOnDocument(permission: PermissionRole) {
  return permission === "COMMENT" || permission === "EDIT";
}

export function canEditDocument(permission: PermissionRole) {
  return permission === "EDIT";
}
