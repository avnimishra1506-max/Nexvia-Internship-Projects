import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-user";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const workspaces = await prisma.workspaceMember.findMany({ where: { userId: user.id }, select: { workspaceId: true } });
    const workspaceIds = workspaces.map((item) => item.workspaceId);
    const documents = await prisma.document.findMany({
      where: { workspaceId: { in: workspaceIds }, isArchived: false },
      orderBy: { updatedAt: "desc" }, take: 12,
      select: { id: true, title: true, icon: true, content: true, updatedAt: true, workspaceId: true, workspace: { select: { name: true, icon: true } } },
    });
    return NextResponse.json({ documents: documents.map(({ content, ...document }) => ({
      ...document,
      preview: (content ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180),
    })) });
  } catch {
    return NextResponse.json({ error: "Could not load recent activity" }, { status: 500 });
  }
}
