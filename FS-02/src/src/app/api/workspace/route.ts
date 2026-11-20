import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-user";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: { include: { _count: { select: { members: true, documents: true } } } } },
      orderBy: { workspace: { updatedAt: "desc" } },
    });
    return NextResponse.json({ workspaces: memberships.map(({ workspace, role }) => ({
      ...workspace, role, memberCount: workspace._count.members,
      documentCount: workspace._count.documents,
    })) });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    const baseSlug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
    const workspace = await prisma.$transaction(async (tx) => {
      let slug = baseSlug;
      for (let i = 1; await tx.workspace.findUnique({ where: { slug } }); i++) slug = `${baseSlug}-${i}`;
      return tx.workspace.create({
        data: {
          name, slug, icon: typeof body.icon === "string" ? body.icon : "📁",
          description: typeof body.description === "string" ? body.description : null,
          members: { create: { userId: user.id, role: "OWNER" } },
        },
        include: { members: true },
      });
    });
    return NextResponse.json({ workspace: { ...workspace, role: "OWNER" } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
