import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-user";
import { canEditDocument, getDocumentAccess } from "@/lib/document-access";

const authorSelect = { id: true, name: true, email: true, avatar: true, cursorColor: true } as const;

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  try {
    if (!await getDocumentAccess(documentId, user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const snapshots = await prisma.documentSnapshot.findMany({ where: { documentId }, include: { createdBy: { select: authorSelect } }, orderBy: { versionNumber: "desc" } });
    return NextResponse.json({ snapshots: snapshots.map((snapshot) => {
      let content: { title?: string; content?: string } = {};
      try { content = snapshot.snapshotJson ? JSON.parse(snapshot.snapshotJson) : {}; } catch {}
      return { ...snapshot, title: snapshot.title, createdBy: snapshot.createdBy, content: content.content ?? "", documentTitle: content.title ?? snapshot.title };
    }) });
  } catch {
    return NextResponse.json({ error: "Failed to load version history" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { documentId, title, content, description, stateVector } = await request.json();
    if (typeof documentId !== "string") return NextResponse.json({ error: "documentId is required" }, { status: 400 });
    const access = await getDocumentAccess(documentId, user.id);
    if (!access || !canEditDocument(access.permission)) return NextResponse.json({ error: "Only editors can create snapshots" }, { status: 403 });
    const snapshot = await prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({ where: { id: documentId }, select: { title: true, content: true } });
      if (!document) throw new Error("Document not found");
      const { _max } = await tx.documentSnapshot.aggregate({ where: { documentId }, _max: { versionNumber: true } });
      const versionNumber = (_max.versionNumber ?? 0) + 1;
      return tx.documentSnapshot.create({
        data: {
          documentId, versionNumber, title: `Version ${versionNumber}`,
          description: typeof description === "string" ? description.slice(0, 500) : "Manual snapshot",
          snapshotJson: JSON.stringify({
            title: typeof title === "string" ? title.slice(0, 240) : document.title,
            content: typeof content === "string" ? content : document.content ?? "",
          }),
          stateVector: typeof stateVector === "string" ? stateVector : null,
          createdById: user.id,
        },
        include: { createdBy: { select: authorSelect } },
      });
    });
    return NextResponse.json({ snapshot: { ...snapshot, createdBy: snapshot.createdBy, content: JSON.parse(snapshot.snapshotJson ?? "{}").content ?? "" } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create version snapshot" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { snapshotId } = await request.json();
    if (typeof snapshotId !== "string") return NextResponse.json({ error: "snapshotId is required" }, { status: 400 });
    const snapshot = await prisma.documentSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    const access = await getDocumentAccess(snapshot.documentId, user.id);
    if (!access || !canEditDocument(access.permission)) return NextResponse.json({ error: "Only editors can restore snapshots" }, { status: 403 });
    let saved: { title?: string; content?: string };
    try { saved = JSON.parse(snapshot.snapshotJson ?? "{}"); } catch { return NextResponse.json({ error: "Snapshot data is invalid" }, { status: 500 }); }
    const document = await prisma.document.update({ where: { id: snapshot.documentId }, data: {
      title: saved.title ?? snapshot.title,
      content: saved.content ?? "",
    } });
    return NextResponse.json({ document });
  } catch {
    return NextResponse.json({ error: "Failed to restore snapshot" }, { status: 500 });
  }
}
