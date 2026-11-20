import { PermissionRole, WorkspaceRole } from "@/types";

export interface PermissionCheckParams {
  userId: string;
  documentId?: string;
  workspaceId?: string;
  userRole?: WorkspaceRole | PermissionRole;
}

export function canEdit(role?: PermissionRole | WorkspaceRole): boolean {
  return role === "EDIT" || role === "OWNER" || role === "ADMIN" || role === "MEMBER";
}

export function canComment(role?: PermissionRole | WorkspaceRole): boolean {
  return canEdit(role) || role === "COMMENT";
}

export function canView(role?: PermissionRole | WorkspaceRole): boolean {
  return role !== undefined;
}

export function getEffectivePermission(
  workspaceRole: WorkspaceRole,
  documentRoleOverride?: PermissionRole
): PermissionRole {
  if (documentRoleOverride) return documentRoleOverride;
  if (workspaceRole === "OWNER" || workspaceRole === "ADMIN" || workspaceRole === "MEMBER") {
    return "EDIT";
  }
  return "VIEW";
}

