export type PermissionRole = "VIEW" | "COMMENT" | "EDIT";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  avatar?: string | null;    // alias used in DB responses
  cursorColor?: string;      // optional — assigned during presence sync
  color?: string;            // alias used in demo data
}

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  role: WorkspaceRole;
}

export interface DocumentItem {
  id: string;
  title: string;
  icon: string;
  coverImage?: string;
  parentDocumentId?: string | null;
  workspaceId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  content?: string;
  children?: DocumentItem[];
  userPermission: PermissionRole;
}

export interface CollaboratorPresence {
  clientId: number | string;
  user: UserProfile & { color?: string };
  cursor?: {
    x: number;
    y: number;
    anchor?: number;
    head?: number;
    blockId?: string;
  };
  lastActive: number;
}

export interface CommentItem {
  id: string;
  threadId: string;
  author: UserProfile;
  content: string;
  createdAt: string;
}

export interface CommentThreadItem {
  id: string;
  documentId: string;
  author: UserProfile;
  position?: string;
  resolved: boolean;
  comments: CommentItem[];
  createdAt: string;
}

export interface VersionSnapshot {
  id: string;
  documentId: string;
  versionNumber: number;
  title: string;
  description?: string;
  createdBy: UserProfile;
  createdAt: string;
  stateVectorSummary?: string;
  content?: string;
}
