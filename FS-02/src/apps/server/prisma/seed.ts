import dotenv from "dotenv";
import path from "node:path";
import { PrismaClient, WorkspaceRole } from "@prisma/client";
import bcrypt from "bcryptjs";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
const prisma = new PrismaClient();

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set DEMO_PASSWORD to a value at least 12 characters long before seeding.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [owner, teammate] = await Promise.all([
    prisma.user.upsert({
      where: { email: "alex@example.test" },
      update: { name: "Alex Rivera", passwordHash },
      create: { email: "alex@example.test", name: "Alex Rivera", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "sam@example.test" },
      update: { name: "Sam Chen", passwordHash },
      create: { email: "sam@example.test", name: "Sam Chen", passwordHash },
    }),
  ]);

  const workspace = await prisma.workspace.upsert({
    where: { id: "demo-workspace" },
    update: { name: "Product team" },
    create: { id: "demo-workspace", name: "Product team" },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: owner.id } },
    update: { role: WorkspaceRole.OWNER },
    create: { workspaceId: workspace.id, userId: owner.id, role: WorkspaceRole.OWNER },
  });
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: teammate.id } },
    update: { role: WorkspaceRole.MEMBER },
    create: { workspaceId: workspace.id, userId: teammate.id, role: WorkspaceRole.MEMBER },
  });

  const page = await prisma.page.upsert({
    where: { id: "demo-welcome-page" },
    update: { title: "Welcome to the team", workspaceId: workspace.id, content: "# Welcome to the team\n\nThis shared page is ready for planning, notes, and discussion." },
    create: {
      id: "demo-welcome-page",
      title: "Welcome to the team",
      content: "# Welcome to the team\n\nThis shared page is ready for planning, notes, and discussion.",
      workspaceId: workspace.id,
      createdById: owner.id,
    },
  });

  console.log(`Seeded ${owner.email}, ${teammate.email}, workspace "${workspace.name}", and page "${page.title}".`);
  console.log("Both demo users share the password set in DEMO_PASSWORD.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
