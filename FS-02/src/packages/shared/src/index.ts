import { z } from "zod";

export const idSchema = z.string().min(1).max(64);
export const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailSchema,
  password: z.string().min(12).max(128),
  inviteToken: z.string().regex(/^[a-f\d]{64}$/i).optional(),
}).strict();
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  avatarUrl: z.string().trim().url().max(2048).nullable().optional(),
  cursorColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
}).strict();
export const accountUpdateSchema = z.object({
  email: emailSchema.optional(),
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128).optional(),
}).strict().refine((value) => value.email !== undefined || value.newPassword !== undefined, "Provide a new email or password.");
export const workspaceInviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
}).strict();
export const inviteTokenSchema = z.string().regex(/^[a-f\d]{64}$/i);
export const workspaceCreateSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
export const workspaceUpdateSchema = workspaceCreateSchema;
export const memberInviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
}).strict();
export const pageCreateSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Untitled page"),
  parentId: idSchema.nullable().optional(),
}).strict();
export const pageUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  parentId: idSchema.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide a title or parentId");
export const pageRoleSchema = z.enum(["VIEW", "COMMENT", "EDIT"]);
export const pagePermissionUpdateSchema = z.object({ role: pageRoleSchema }).strict();
export const commentCreateSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  parentCommentId: idSchema.optional(),
}).strict();
export const commentResolveSchema = z.object({ resolved: z.boolean() }).strict();
export const versionCreateSchema = z.object({
  snapshot: z.unknown(),
  description: z.string().trim().max(200).optional(),
}).strict().refine((value) => {
  try { return JSON.stringify(value.snapshot).length <= 250_000; } catch { return false; }
}, "Snapshot is too large or invalid.");

export type SafeUser = { id: string; name: string; email: string; avatarUrl: string | null; cursorColor?: string };
export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type PageRole = "VIEW" | "COMMENT" | "EDIT";
export const pageRoleCanComment = (role: PageRole): boolean => role === "COMMENT" || role === "EDIT";
export const pageRoleCanEdit = (role: PageRole): boolean => role === "EDIT";
export const workspaceRoleCanEdit = (role: WorkspaceRole): boolean => role !== "VIEWER";
export const workspaceRoleCanManage = (role: WorkspaceRole): boolean => role === "OWNER" || role === "ADMIN";
export type PageSummary = { id: string; title: string; parentId: string | null; updatedAt: string };
export type WorkspaceSummary = {
  id: string;
  name: string;
  role: WorkspaceRole;
  pages: PageSummary[];
  members: Array<{ user: SafeUser; role: WorkspaceRole }>;
};
