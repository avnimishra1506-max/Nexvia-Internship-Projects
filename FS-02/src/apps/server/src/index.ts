import dotenv from "dotenv";
import path from "node:path";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { Prisma, PrismaClient, WorkspaceRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { z, ZodError } from "zod";
import {
  idSchema, loginSchema, memberInviteSchema, pageCreateSchema, pageUpdateSchema,
  registerSchema, workspaceCreateSchema, workspaceUpdateSchema, pagePermissionUpdateSchema,
  commentCreateSchema, commentResolveSchema, versionCreateSchema,
  workspaceInviteSchema, inviteTokenSchema, profileUpdateSchema, accountUpdateSchema,
  workspaceRoleCanEdit, workspaceRoleCanManage, pageRoleCanComment, pageRoleCanEdit, type SafeUser,
} from "@collab/shared";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().trim().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
}).superRefine((value, ctx) => {
  if (!value.JWT_SECRET && !value.SESSION_SECRET) {
    ctx.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "Set JWT_SECRET (at least 32 characters)" });
  }
  const smtpPartiallyConfigured = Boolean(value.SMTP_HOST || value.SMTP_FROM || value.SMTP_USER || value.SMTP_PASSWORD);
  if (smtpPartiallyConfigured && (!value.SMTP_HOST || !value.SMTP_FROM)) {
    ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP_HOST and SMTP_FROM are both required to send email" });
  }
  if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD)) {
    ctx.addIssue({ code: "custom", path: ["SMTP_USER"], message: "Set both SMTP_USER and SMTP_PASSWORD, or leave both empty" });
  }
});
const env = envSchema.parse(process.env);
const tokenSecret = env.JWT_SECRET ?? env.SESSION_SECRET!;
const prisma = new PrismaClient();
const app = express();
const mailer = env.SMTP_HOST && env.SMTP_FROM ? nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD! } : undefined,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
}) : null;
const COOKIE_NAME = "collab_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type AuthRequest = Request & { userId?: string };
const asyncRoute = (handler: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(handler(req as AuthRequest, res, next)).catch(next);

function signToken(userId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS })).toString("base64url");
  const data = `${header}.${payload}`;
  return `${data}.${createHmac("sha256", tokenSecret).update(data).digest("base64url")}`;
}
function hashInviteToken(token: string): string {
  return createHash("sha256").update(token.toLowerCase()).digest("hex");
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
async function sendWorkspaceInviteEmail({ to, workspaceName, role, inviteUrl, existingMember = false }: {
  to: string; workspaceName: string; role: string; inviteUrl: string; existingMember?: boolean;
}): Promise<{ sent: boolean; message: string }> {
  if (!mailer || !env.SMTP_FROM) return { sent: false, message: existingMember ? "Member added; SMTP is not configured, so no email notification was sent." : "SMTP is not configured; share the invitation link manually." };
  const safeWorkspace = escapeHtml(workspaceName);
  const safeRole = escapeHtml(role.toLowerCase());
  const subject = existingMember ? `You’ve been added to ${workspaceName}` : `Invitation to ${workspaceName}`;
  const intro = existingMember ? `You now have ${safeRole} access to` : `You’re invited to join`;
  try {
    await mailer.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text: `${intro} ${workspaceName}. Open ${inviteUrl}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#29332d"><h2>${safeWorkspace}</h2><p>${intro} <strong>${safeWorkspace}</strong> as ${safeRole}.</p><p><a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#285342;color:#fff;padding:11px 16px;border-radius:6px;text-decoration:none">${existingMember ? "Open workspace" : "Accept invitation"}</a></p>${existingMember ? "" : "<p>This invitation expires in seven days and can only be used once.</p>"}</div>`,
    });
    return { sent: true, message: existingMember ? "Member added and email notification sent." : "Invitation email sent." };
  } catch (error) {
    console.error("[Email] Workspace invite could not be sent:", error);
    return { sent: false, message: existingMember ? "Member added, but email delivery failed." : "Email delivery failed; share the invitation link manually." };
  }
}
async function usableInvite(token: string) {
  const invite = await prisma.workspaceInvite.findUnique({ where: { tokenHash: hashInviteToken(token) }, include: { workspace: { select: { name: true } } } });
  if (!invite || invite.acceptedAt) throw new HttpError(404, "This invitation is invalid or has already been used.");
  if (invite.expiresAt <= new Date()) throw new HttpError(410, "This invitation has expired.");
  return invite;
}
function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = createHmac("sha256", tokenSecret).update(data).digest();
  let provided: Buffer;
  try { provided = Buffer.from(parts[2], "base64url"); } catch { return null; }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { sub?: unknown; exp?: unknown };
    return typeof payload.sub === "string" && typeof payload.exp === "number" && payload.exp > Date.now() / 1000 ? payload.sub : null;
  } catch { return null; }
}
function getCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}
function setAuthCookie(res: Response, token: string | null) {
  const value = token ? `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${TOKEN_TTL_SECONDS}${env.NODE_ENV === "production" ? "; Secure" : ""}` : `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${env.NODE_ENV === "production" ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", value);
}
const requireAuth = asyncRoute(async (req, _res, next) => {
  const token = getCookie(req, COOKIE_NAME);
  const userId = token ? verifyToken(token) : null;
  if (!userId) throw new HttpError(401, "Please sign in to continue.");
  req.userId = userId;
  next();
});
function body<T>(schema: z.ZodType<T>, req: Request): T {
  return schema.parse(req.body);
}
function param(req: Request, name: string): string {
  return idSchema.parse(req.params[name]);
}
function publicUser(user: { id: string; name: string; email: string; avatarUrl: string | null; cursorColor?: string }): SafeUser {
  return { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, ...(user.cursorColor ? { cursorColor: user.cursorColor } : {}) };
}
async function workspaceAccess(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!member) throw new HttpError(404, "Workspace not found.");
  return member;
}
async function canManageWorkspace(workspaceId: string, userId: string) {
  const member = await workspaceAccess(workspaceId, userId);
  if (!workspaceRoleCanManage(member.role)) throw new HttpError(403, "You do not have permission to manage this workspace.");
  return member;
}
async function canEditWorkspace(workspaceId: string, userId: string) {
  const member = await workspaceAccess(workspaceId, userId);
  if (!workspaceRoleCanEdit(member.role)) throw new HttpError(403, "You do not have permission to edit this workspace.");
  return member;
}
async function pageAuthorization(pageId: string, userId: string) {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      workspaceId: true,
      workspace: { select: { members: { where: { userId }, select: { role: true } } } },
      permissions: { where: { userId }, select: { role: true } },
    },
  });
  if (!page) throw new HttpError(404, "Page not found.");
  const membership = page.workspace.members[0];
  if (!membership) throw new HttpError(404, "Page not found.");
  const role = page.permissions[0]?.role ?? (membership.role === WorkspaceRole.VIEWER ? "VIEW" : "EDIT");
  return { page, membership, role };
}

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] }));
app.use(express.json({ limit: "32kb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false });
app.post("/api/auth/register", authLimiter, asyncRoute(async (req, res) => {
  const input = body(registerSchema, req);
  const invite = input.inviteToken ? await usableInvite(input.inviteToken) : null;
  if (invite && invite.email !== input.email) throw new HttpError(403, "This invitation was sent to a different email address.");
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { name: input.name, email: input.email, passwordHash } });
    if (invite) {
      const claimed = await tx.workspaceInvite.updateMany({ where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
      if (claimed.count !== 1) throw new HttpError(410, "This invitation has expired or has already been used.");
      await tx.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: created.id } }, update: { role: invite.role }, create: { workspaceId: invite.workspaceId, userId: created.id, role: invite.role } });
    } else {
      const workspace = await tx.workspace.create({ data: { name: `${input.name}'s workspace` } });
      await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId: created.id, role: WorkspaceRole.OWNER } });
      await tx.page.create({ data: { workspaceId: workspace.id, createdById: created.id, title: "Welcome" } });
    }
    return created;
  });
  setAuthCookie(res, signToken(user.id));
  res.status(201).json({ user: publicUser(user) });
}));
app.post("/api/auth/login", authLimiter, asyncRoute(async (req, res) => {
  const input = body(loginSchema, req);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new HttpError(401, "Email or password is incorrect.");
  setAuthCookie(res, signToken(user.id));
  res.json({ user: publicUser(user) });
}));
app.post("/api/auth/logout", (_req, res) => { setAuthCookie(res, null); res.status(204).end(); });
app.get("/api/auth/me", requireAuth, asyncRoute(async (req, res) => {
  const [user] = await prisma.$queryRaw<Array<{ id: string; name: string; email: string; avatarUrl: string | null; cursorColor: string }>>`SELECT "id", "name", "email", "avatarUrl", "cursorColor" FROM "User" WHERE "id" = ${req.userId!}`;
  if (!user) throw new HttpError(401, "Please sign in to continue.");
  res.json({ user: publicUser(user) });
}));
app.patch("/api/auth/profile", requireAuth, asyncRoute(async (req, res) => {
  const input = body(profileUpdateSchema, req);
  const avatarUrl = input.avatarUrl ?? null;
  await prisma.$executeRaw`UPDATE "User" SET "name" = ${input.name}, "avatarUrl" = ${avatarUrl}, "cursorColor" = ${input.cursorColor}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${req.userId!}`;
  const [user] = await prisma.$queryRaw<Array<{ id: string; name: string; email: string; avatarUrl: string | null; cursorColor: string }>>`SELECT "id", "name", "email", "avatarUrl", "cursorColor" FROM "User" WHERE "id" = ${req.userId!}`;
  if (!user) throw new HttpError(404, "User not found.");
  res.json({ user: publicUser(user) });
}));
app.patch("/api/auth/account", authLimiter, requireAuth, asyncRoute(async (req, res) => {
  const input = body(accountUpdateSchema, req);
  const existing = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!existing || !(await bcrypt.compare(input.currentPassword, existing.passwordHash))) throw new HttpError(403, "Current password is incorrect.");
  const data: { email?: string; passwordHash?: string } = {};
  if (input.email) data.email = input.email;
  if (input.newPassword) data.passwordHash = await bcrypt.hash(input.newPassword, 12);
  try {
    await prisma.user.update({ where: { id: req.userId! }, data, select: { id: true } });
    const [user] = await prisma.$queryRaw<Array<{ id: string; name: string; email: string; avatarUrl: string | null; cursorColor: string }>>`SELECT "id", "name", "email", "avatarUrl", "cursorColor" FROM "User" WHERE "id" = ${req.userId!}`;
    if (!user) throw new HttpError(404, "User not found.");
    res.json({ user: publicUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new HttpError(409, "That email address is already in use.");
    throw error;
  }
}));

app.get("/api/workspaces", requireAuth, asyncRoute(async (req, res) => {
  const rows = await prisma.workspace.findMany({
    where: { members: { some: { userId: req.userId! } } }, orderBy: { updatedAt: "desc" },
    include: { members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } }, pages: { orderBy: { updatedAt: "desc" }, select: { id: true, title: true, parentId: true, updatedAt: true, permissions: { where: { userId: req.userId! }, select: { role: true } } } } },
  });
  res.json({ workspaces: rows.map((w) => {
    const workspaceRole = w.members.find((m) => m.userId === req.userId)!.role;
    return { id: w.id, name: w.name, role: workspaceRole, pages: w.pages.map((p) => ({ id: p.id, title: p.title, parentId: p.parentId, updatedAt: p.updatedAt.toISOString(), accessRole: p.permissions[0]?.role ?? (workspaceRole === WorkspaceRole.VIEWER ? "VIEW" : "EDIT") })), members: w.members.map((m) => ({ user: publicUser(m.user), role: m.role })) };
  }) });
}));
app.post("/api/workspaces", requireAuth, asyncRoute(async (req, res) => {
  const input = body(workspaceCreateSchema, req);
  const workspace = await prisma.workspace.create({ data: { name: input.name, members: { create: { userId: req.userId!, role: WorkspaceRole.OWNER } }, pages: { create: { title: "Welcome", createdById: req.userId! } } } });
  res.status(201).json({ workspace: { id: workspace.id, name: workspace.name, role: WorkspaceRole.OWNER, pages: [], members: [] } });
}));
app.patch("/api/workspaces/:workspaceId", requireAuth, asyncRoute(async (req, res) => {
  const workspaceId = param(req, "workspaceId");
  const input = body(workspaceUpdateSchema, req);
  await canManageWorkspace(workspaceId, req.userId!);
  const workspace = await prisma.workspace.update({ where: { id: workspaceId }, data: { name: input.name } });
  res.json({ workspace: { id: workspace.id, name: workspace.name } });
}));
app.delete("/api/workspaces/:workspaceId", requireAuth, asyncRoute(async (req, res) => {
  const workspaceId = param(req, "workspaceId");
  const member = await workspaceAccess(workspaceId, req.userId!);
  if (member.role !== WorkspaceRole.OWNER) throw new HttpError(403, "Only the owner can delete this workspace.");
  await prisma.workspace.delete({ where: { id: workspaceId } });
  res.status(204).end();
}));
app.post("/api/workspaces/:workspaceId/members", requireAuth, asyncRoute(async (req, res) => {
  const workspaceId = param(req, "workspaceId");
  const input = body(memberInviteSchema, req);
  await canManageWorkspace(workspaceId, req.userId!);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new HttpError(404, "No account exists for that email yet. Ask them to register, then invite them.");
  const member = await prisma.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId, userId: user.id } }, update: { role: input.role }, create: { workspaceId, userId: user.id, role: input.role }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } });
  res.status(201).json({ member: { user: publicUser(member.user), role: member.role } });
}));
app.delete("/api/workspaces/:workspaceId/members/:memberId", requireAuth, asyncRoute(async (req, res) => {
  const workspaceId = param(req, "workspaceId");
  const memberId = param(req, "memberId");
  const actor = await canManageWorkspace(workspaceId, req.userId!);
  if (memberId === req.userId) throw new HttpError(400, "You cannot remove your own account from this workspace.");
  const target = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: memberId } } });
  if (!target) throw new HttpError(404, "Workspace member not found.");
  if (target.role === WorkspaceRole.OWNER) throw new HttpError(403, "The workspace owner cannot be removed.");
  if (actor.role === WorkspaceRole.ADMIN && target.role === WorkspaceRole.ADMIN) throw new HttpError(403, "Only the owner can remove another admin.");
  await prisma.$transaction(async (tx) => {
    await tx.pagePermission.deleteMany({ where: { userId: memberId, page: { workspaceId } } });
    await tx.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId: memberId } } });
  });
  res.status(204).end();
}));

app.get("/api/workspaces/:workspaceId/invites", requireAuth, asyncRoute(async (req, res) => {
  const workspaceId = param(req, "workspaceId");
  await canManageWorkspace(workspaceId, req.userId!);
  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ invites: invites.map((invite) => ({ ...invite, expiresAt: invite.expiresAt.toISOString(), createdAt: invite.createdAt.toISOString() })) });
}));
app.post("/api/workspaces/:workspaceId/invites", requireAuth, asyncRoute(async (req, res) => {
  const workspaceId = param(req, "workspaceId");
  const input = body(workspaceInviteSchema, req);
  await canManageWorkspace(workspaceId, req.userId!);
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
  if (!workspace) throw new HttpError(404, "Workspace not found.");
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    const member = await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      update: { role: input.role },
      create: { workspaceId, userId: existingUser.id, role: input.role },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
    const delivery = await sendWorkspaceInviteEmail({ to: member.user.email, workspaceName: workspace.name, role: member.role, inviteUrl: new URL(`/?workspace=${workspaceId}`, env.CORS_ORIGIN).toString(), existingMember: true });
    return res.status(201).json({ member: { user: publicUser(member.user), role: member.role }, emailSent: delivery.sent, message: delivery.message });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invite = await prisma.workspaceInvite.upsert({
    where: { workspaceId_email: { workspaceId, email: input.email } },
    update: { role: input.role, tokenHash: hashInviteToken(token), expiresAt, acceptedAt: null, invitedById: req.userId! },
    create: { workspaceId, email: input.email, role: input.role, tokenHash: hashInviteToken(token), expiresAt, invitedById: req.userId! },
    select: { id: true, email: true, role: true, expiresAt: true },
  });
  const inviteUrl = new URL(`/?invite=${token}`, env.CORS_ORIGIN).toString();
  const delivery = await sendWorkspaceInviteEmail({ to: invite.email, workspaceName: workspace.name, role: invite.role, inviteUrl });
  res.status(201).json({ invite: { ...invite, expiresAt: invite.expiresAt.toISOString(), url: inviteUrl }, emailSent: delivery.sent, message: delivery.message });
}));
app.delete("/api/workspaces/:workspaceId/invites/:inviteId", requireAuth, asyncRoute(async (req, res) => {
  const workspaceId = param(req, "workspaceId");
  const inviteId = param(req, "inviteId");
  await canManageWorkspace(workspaceId, req.userId!);
  await prisma.workspaceInvite.deleteMany({ where: { id: inviteId, workspaceId, acceptedAt: null } });
  res.status(204).end();
}));
app.get("/api/invites/:token", asyncRoute(async (req, res) => {
  const token = inviteTokenSchema.parse(req.params.token);
  const invite = await usableInvite(token);
  res.json({ invite: { email: invite.email, role: invite.role, workspaceName: invite.workspace.name, expiresAt: invite.expiresAt.toISOString() } });
}));
app.post("/api/invites/:token/accept", requireAuth, asyncRoute(async (req, res) => {
  const token = inviteTokenSchema.parse(req.params.token);
  const invite = await usableInvite(token);
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } });
  if (!user || user.email !== invite.email) throw new HttpError(403, `This invitation is for ${invite.email}. Sign in with that email address.`);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.workspaceInvite.updateMany({ where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) throw new HttpError(410, "This invitation has expired or has already been used.");
    await tx.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: req.userId! } }, update: { role: invite.role }, create: { workspaceId: invite.workspaceId, userId: req.userId!, role: invite.role } });
  });
  res.json({ workspaceId: invite.workspaceId });
}));

app.get("/api/workspaces/:workspaceId/pages", requireAuth, asyncRoute(async (req, res) => {
  const workspaceId = param(req, "workspaceId");
  await workspaceAccess(workspaceId, req.userId!);
  const pages = await prisma.page.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, parentId: true, updatedAt: true } });
  res.json({ pages: pages.map((page) => ({ ...page, updatedAt: page.updatedAt.toISOString() })) });
}));
app.post("/api/workspaces/:workspaceId/pages", requireAuth, asyncRoute(async (req, res) => {
  const workspaceId = param(req, "workspaceId");
  const input = body(pageCreateSchema, req);
  await canEditWorkspace(workspaceId, req.userId!);
  if (input.parentId) {
    const parent = await prisma.page.findFirst({ where: { id: input.parentId, workspaceId }, select: { id: true } });
    if (!parent) throw new HttpError(400, "Parent page must belong to this workspace.");
  }
  const page = await prisma.page.create({ data: { workspaceId, title: input.title, parentId: input.parentId, createdById: req.userId! }, select: { id: true, title: true, parentId: true, updatedAt: true } });
  res.status(201).json({ page: { ...page, updatedAt: page.updatedAt.toISOString() } });
}));
app.patch("/api/pages/:pageId", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  const input = body(pageUpdateSchema, req);
  const page = await prisma.page.findUnique({ where: { id: pageId }, select: { id: true, workspaceId: true } });
  if (!page) throw new HttpError(404, "Page not found.");
  await canEditWorkspace(page.workspaceId, req.userId!);
  if (input.parentId === pageId) throw new HttpError(400, "A page cannot be its own parent.");
  if (input.parentId) {
    const parent = await prisma.page.findFirst({ where: { id: input.parentId, workspaceId: page.workspaceId }, select: { id: true } });
    if (!parent) throw new HttpError(400, "Parent page must belong to this workspace.");
    let ancestorId: string | null = parent.id;
    const visited = new Set<string>();
    while (ancestorId && !visited.has(ancestorId)) {
      if (ancestorId === pageId) throw new HttpError(400, "A page cannot be nested inside its own descendant.");
      visited.add(ancestorId);
      ancestorId = (await prisma.page.findUnique({ where: { id: ancestorId }, select: { parentId: true } }))?.parentId ?? null;
    }
  }
  const updated = await prisma.page.update({ where: { id: pageId }, data: input, select: { id: true, title: true, parentId: true, updatedAt: true } });
  res.json({ page: { ...updated, updatedAt: updated.updatedAt.toISOString() } });
}));
app.delete("/api/pages/:pageId", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  const page = await prisma.page.findUnique({ where: { id: pageId }, select: { id: true, workspaceId: true } });
  if (!page) throw new HttpError(404, "Page not found.");
  const member = await workspaceAccess(page.workspaceId, req.userId!);
  if (member.role === WorkspaceRole.VIEWER) throw new HttpError(403, "You do not have permission to delete pages.");
  await prisma.page.delete({ where: { id: pageId } });
  res.status(204).end();
}));

app.get("/api/pages/:pageId/permissions", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  const { page } = await pageAuthorization(pageId, req.userId!);
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: page.workspaceId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const permissions = await prisma.pagePermission.findMany({ where: { pageId } });
  const explicit = new Map(permissions.map((permission) => [permission.userId, permission.role]));
  res.json({ permissions: members.map((member) => ({
    user: publicUser(member.user),
    workspaceRole: member.role,
    role: explicit.get(member.userId) ?? (member.role === WorkspaceRole.VIEWER ? "VIEW" : "EDIT"),
    inherited: !explicit.has(member.userId),
  })) });
}));
app.put("/api/pages/:pageId/permissions/:userId", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  const userId = param(req, "userId");
  const input = body(pagePermissionUpdateSchema, req);
  const { page } = await pageAuthorization(pageId, req.userId!);
  await canManageWorkspace(page.workspaceId, req.userId!);
  const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: page.workspaceId, userId } } });
  if (!member) throw new HttpError(404, "That user is not a member of this workspace.");
  const permission = await prisma.pagePermission.upsert({
    where: { pageId_userId: { pageId, userId } },
    update: { role: input.role },
    create: { pageId, userId, role: input.role },
  });
  res.json({ permission: { pageId, userId, role: permission.role, inherited: false } });
}));
app.delete("/api/pages/:pageId/permissions/:userId", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  const userId = param(req, "userId");
  const { page } = await pageAuthorization(pageId, req.userId!);
  await canManageWorkspace(page.workspaceId, req.userId!);
  await prisma.pagePermission.deleteMany({ where: { pageId, userId } });
  res.status(204).end();
}));

app.get("/api/pages/:pageId/comments", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  await pageAuthorization(pageId, req.userId!);
  const threads = await prisma.comment.findMany({
    where: { pageId, parentCommentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      replies: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  });
  res.json({ threads: threads.map((thread) => ({
    id: thread.threadId,
    commentId: thread.id,
    resolved: thread.resolved,
    body: thread.body,
    anchor: thread.anchor,
    createdAt: thread.createdAt.toISOString(),
    author: thread.author,
    replies: thread.replies.map((reply) => ({ id: reply.id, body: reply.body, createdAt: reply.createdAt.toISOString(), author: reply.author })),
  })) });
}));
app.post("/api/pages/:pageId/comments", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  const input = body(commentCreateSchema, req);
  const access = await pageAuthorization(pageId, req.userId!);
  if (!pageRoleCanComment(access.role)) throw new HttpError(403, "You do not have permission to comment on this page.");
  let threadId: string = randomUUID();
  if (input.parentCommentId) {
    const parent = await prisma.comment.findFirst({ where: { id: input.parentCommentId, pageId, parentCommentId: null }, select: { threadId: true } });
    if (!parent) throw new HttpError(404, "Comment thread not found.");
    threadId = parent.threadId;
  }
  const comment = await prisma.comment.create({
    data: { pageId, threadId, body: input.body, parentCommentId: input.parentCommentId, authorId: req.userId! },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.status(201).json({ comment: { id: comment.id, threadId, body: comment.body, createdAt: comment.createdAt.toISOString(), author: comment.author } });
}));
app.patch("/api/pages/:pageId/comments/:threadId", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  const threadId = param(req, "threadId");
  const input = body(commentResolveSchema, req);
  const access = await pageAuthorization(pageId, req.userId!);
  if (!pageRoleCanEdit(access.role)) throw new HttpError(403, "Only editors can resolve comment threads.");
  const result = await prisma.comment.updateMany({ where: { pageId, threadId }, data: { resolved: input.resolved } });
  if (!result.count) throw new HttpError(404, "Comment thread not found.");
  res.json({ threadId, resolved: input.resolved });
}));

app.get("/api/pages/:pageId/versions", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  await pageAuthorization(pageId, req.userId!);
  const versions = await prisma.pageVersion.findMany({
    where: { pageId }, orderBy: { createdAt: "desc" }, take: 50,
    include: { createdBy: { select: { id: true, name: true } } },
  });
  res.json({ versions: versions.map((version) => ({ id: version.id, description: version.description, createdAt: version.createdAt.toISOString(), createdBy: version.createdBy })) });
}));
app.post("/api/pages/:pageId/versions", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  const input = body(versionCreateSchema, req);
  const access = await pageAuthorization(pageId, req.userId!);
  if (!pageRoleCanEdit(access.role)) throw new HttpError(403, "You do not have permission to save versions of this page.");
  const serialized = JSON.stringify(input.snapshot);
  if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > 1_000_000) throw new HttpError(413, "Version snapshot is too large.");
  const version = await prisma.pageVersion.create({
    data: { pageId, snapshot: Buffer.from(serialized, "utf8"), description: input.description, createdById: req.userId! },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  res.status(201).json({ version: { id: version.id, description: version.description, createdAt: version.createdAt.toISOString(), createdBy: version.createdBy } });
}));
app.get("/api/pages/:pageId/versions/:versionId", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  const versionId = param(req, "versionId");
  await pageAuthorization(pageId, req.userId!);
  const version = await prisma.pageVersion.findFirst({
    where: { id: versionId, pageId },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!version) throw new HttpError(404, "Version not found.");
  try {
    res.json({ version: { id: version.id, description: version.description, createdAt: version.createdAt.toISOString(), createdBy: version.createdBy }, snapshot: JSON.parse(version.snapshot.toString("utf8")) as unknown });
  } catch { throw new HttpError(500, "This version cannot be previewed."); }
}));
app.post("/api/pages/:pageId/versions/:versionId/restore", requireAuth, asyncRoute(async (req, res) => {
  const pageId = param(req, "pageId");
  const versionId = param(req, "versionId");
  const access = await pageAuthorization(pageId, req.userId!);
  if (!pageRoleCanEdit(access.role)) throw new HttpError(403, "You do not have permission to restore versions of this page.");
  const version = await prisma.pageVersion.findFirst({ where: { id: versionId, pageId } });
  if (!version) throw new HttpError(404, "Version not found.");
  try { res.json({ snapshot: JSON.parse(version.snapshot.toString("utf8")) as unknown }); }
  catch { throw new HttpError(500, "This version cannot be restored."); }
}));

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError || (error instanceof Error && error.name === "ZodError" && "issues" in error)) {
    const issues = (error as ZodError).issues;
    return res.status(400).json({ error: "Invalid request.", details: issues.map(({ path, message }) => ({ path: path.join("."), message })) });
  }
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "An account with this email already exists." });
  console.error(error);
  return res.status(500).json({ error: "Something went wrong. Please try again." });
};
app.use(errorHandler);

export { app, prisma };

if (env.NODE_ENV !== "test") {
  const server = app.listen(env.API_PORT, () => console.log(`Collab Workspace API listening on http://localhost:${env.API_PORT}`));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close(async () => { await prisma.$disconnect(); process.exit(0); }));
}
