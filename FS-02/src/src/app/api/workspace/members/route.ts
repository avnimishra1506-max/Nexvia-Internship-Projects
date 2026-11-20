import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-user";

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, email, role } = await request.json();
  if (typeof workspaceId !== "string" || typeof email !== "string") return NextResponse.json({ error: "workspaceId and email are required" }, { status: 400 });
  const inviter = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } });
  if (!inviter || !["OWNER", "ADMIN"].includes(inviter.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const invitee = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!invitee) return NextResponse.json({ error: "Create an account for this user before adding them" }, { status: 404 });
  const allowedRole = ["ADMIN", "MEMBER", "VIEWER"].includes(role) ? role : "MEMBER";
  const where = { workspaceId_userId: { workspaceId, userId: invitee.id } };
  const existing = await prisma.workspaceMember.findUnique({ where, include: { user: { select: { id: true, name: true, email: true } } } });
  if (existing) return NextResponse.json({ member: existing });
  const member = await prisma.workspaceMember.create({ data: { workspaceId, userId: invitee.id, role: allowedRole }, include: { user: { select: { id: true, name: true, email: true } } } });
  return NextResponse.json({ member }, { status: 201 });
}
