import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-user";
import { canEditDocument, getDocumentAccess } from "@/lib/document-access";

const userSelect = { id: true, name: true, email: true, avatar: true, cursorColor: true } as const;

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  try {
    const access = await getDocumentAccess(documentId, user.id);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const workspace = await prisma.workspace.findUnique({ where: { id: access.workspaceId }, include: { members: { include: { user: { select: userSelect } } } } });
    const overrides = await prisma.documentPermission.findMany({ where: { documentId }, select: { userId: true, role: true } });
    const permissionByUser = new Map(overrides.map((item) => [item.userId, item.role]));
    return NextResponse.json({ currentUserId: user.id, members: workspace?.members.map(({ user: member, role }) => ({
      user: member,
      role: permissionByUser.get(member.id) ?? (role === "VIEWER" ? "VIEW" : "EDIT"),
      workspaceRole: role,
    })) ?? [] });
  } catch {
    return NextResponse.json({ error: "Failed to load permissions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { documentId, email, role } = await request.json();
    if (typeof documentId !== "string" || typeof email !== "string" || !["VIEW", "COMMENT", "EDIT"].includes(role)) return NextResponse.json({ error: "documentId, email, and a valid role are required" }, { status: 400 });
    const access = await getDocumentAccess(documentId, user.id);
    if (!access || !canEditDocument(access.permission)) return NextResponse.json({ error: "Only editors can change page permissions" }, { status: 403 });
    const target = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: userSelect });
    if (!target) return NextResponse.json({ error: "Create an account for this user before sharing" }, { status: 404 });
    const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: access.workspaceId, userId: target.id } } });
    if (!membership) return NextResponse.json({ error: "Add this user to the workspace first" }, { status: 409 });
    const permission = await prisma.documentPermission.upsert({
      where: { documentId_userId: { documentId, userId: target.id } },
      update: { role }, create: { documentId, userId: target.id, role },
    });
    return NextResponse.json({ permission, user: target }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to update page permission" }, { status: 500 });
  }
}
