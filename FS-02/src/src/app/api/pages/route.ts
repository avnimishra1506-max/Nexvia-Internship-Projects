import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-user";
import { getDocumentAccess } from "@/lib/document-access";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  try {
    const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const documents = await prisma.document.findMany({
      where: { workspaceId, isArchived: false }, include: { permissions: { where: { userId: user.id } } }, orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ documents: documents.map(({ permissions, ...doc }) => ({ ...doc, userPermission: permissions[0]?.role ?? (membership.role === "VIEWER" ? "VIEW" : "EDIT") })) });
  } catch {
    return NextResponse.json({ error: "Failed to load pages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { title, icon, parentDocumentId, workspaceId } = await request.json();
    if (typeof workspaceId !== "string" || !workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } });
    if (!membership || membership.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (parentDocumentId) {
      const parent = await prisma.document.findFirst({ where: { id: parentDocumentId, workspaceId } });
      if (!parent) return NextResponse.json({ error: "Parent page not found" }, { status: 404 });
    }
    const document = await prisma.document.create({ data: {
      title: typeof title === "string" && title.trim() ? title.trim() : "Untitled Document",
      icon: typeof icon === "string" ? icon : "📄", parentDocumentId: parentDocumentId || null,
      workspaceId, createdById: user.id,
      content: `<h1>${escapeHtml(typeof title === "string" && title.trim() ? title.trim() : "Untitled Document")}</h1><p>Start writing here...</p>`,
    } });
    return NextResponse.json({ document: { ...document, children: [], userPermission: "EDIT" } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create page" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, title, content } = await request.json();
    if (typeof id !== "string") return NextResponse.json({ error: "Page id is required" }, { status: 400 });
    const doc = await prisma.document.findUnique({ where: { id } });
    const access = doc && await getDocumentAccess(id, user.id);
    if (!doc || !access || access.permission !== "EDIT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const updated = await prisma.document.update({ where: { id }, data: {
      ...(typeof title === "string" ? { title: title.slice(0, 240) } : {}),
      ...(typeof content === "string" ? { content } : {}),
    } });
    return NextResponse.json({ document: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update page" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Page id is required" }, { status: 400 });
  const doc = await prisma.document.findUnique({ where: { id } });
  const access = doc && await getDocumentAccess(id, user.id);
  if (!doc || !access || access.permission !== "EDIT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
