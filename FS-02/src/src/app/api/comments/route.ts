import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-user";
import { canCommentOnDocument, canEditDocument, getDocumentAccess } from "@/lib/document-access";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  try {
    const access = await getDocumentAccess(documentId, user.id);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const threads = await prisma.commentThread.findMany({
      where: { documentId },
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true, cursorColor: true } },
        comments: { include: { author: { select: { id: true, name: true, email: true, avatar: true, cursorColor: true } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ threads });
  } catch {
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { documentId, threadId, content, position } = await request.json();
    if (typeof documentId !== "string" || typeof content !== "string" || !content.trim()) return NextResponse.json({ error: "documentId and comment text are required" }, { status: 400 });
    const access = await getDocumentAccess(documentId, user.id);
    if (!access || !canCommentOnDocument(access.permission)) return NextResponse.json({ error: "You do not have permission to comment" }, { status: 403 });

    if (typeof threadId === "string") {
      const thread = await prisma.commentThread.findFirst({ where: { id: threadId, documentId } });
      if (!thread) return NextResponse.json({ error: "Comment thread not found" }, { status: 404 });
      const comment = await prisma.comment.create({ data: { threadId, authorId: user.id, content: content.trim() }, include: { author: { select: { id: true, name: true, email: true, avatar: true, cursorColor: true } } } });
      return NextResponse.json({ comment }, { status: 201 });
    }

    const thread = await prisma.commentThread.create({
      data: { documentId, authorId: user.id, position: typeof position === "string" ? position.slice(0, 500) : null, comments: { create: { authorId: user.id, content: content.trim() } } },
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true, cursorColor: true } },
        comments: { include: { author: { select: { id: true, name: true, email: true, avatar: true, cursorColor: true } } } },
      },
    });
    return NextResponse.json({ thread }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { threadId, resolved } = await request.json();
    if (typeof threadId !== "string" || typeof resolved !== "boolean") return NextResponse.json({ error: "threadId and resolved are required" }, { status: 400 });
    const thread = await prisma.commentThread.findUnique({ where: { id: threadId }, select: { documentId: true } });
    if (!thread) return NextResponse.json({ error: "Comment thread not found" }, { status: 404 });
    const access = await getDocumentAccess(thread.documentId, user.id);
    if (!access || !canEditDocument(access.permission)) return NextResponse.json({ error: "Only editors can resolve comment threads" }, { status: 403 });
    const updated = await prisma.commentThread.update({ where: { id: threadId }, data: { resolved } });
    return NextResponse.json({ thread: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update comment thread" }, { status: 500 });
  }
}
