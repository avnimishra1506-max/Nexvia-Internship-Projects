import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const pages = [
  {
    title: "Product launch brief",
    icon: "🚀",
    content: `<h1>Product launch brief</h1><p>A shared plan for taking our next release from beta to launch.</p><h2>Launch goals</h2><ul><li>Reach 500 active trial teams in the first month</li><li>Keep onboarding completion above 70%</li><li>Collect feedback from at least 30 design partners</li></ul><h2>This week</h2><p>Finalize the onboarding checklist, confirm the launch date, and prepare the customer announcement.</p>`,
  },
  {
    title: "Customer interview synthesis",
    icon: "💬",
    content: `<h1>Customer interview synthesis</h1><p>Notes from recent conversations with teams testing the workspace.</p><h2>What is working</h2><ul><li>People can find shared pages quickly</li><li>Live editing makes reviews feel faster</li></ul><h2>What needs attention</h2><p>New members want clearer permission labels and a visible way to return to recent work.</p>`,
  },
  {
    title: "Engineering decision log",
    icon: "⚙️",
    content: `<h1>Engineering decision log</h1><h2>Decision: keep pages workspace-scoped</h2><p>Every page belongs to one workspace. Membership controls discovery and page roles control editing, commenting, and viewing.</p><h2>Follow-up</h2><p>Check reconnect behavior with two browser clients before the next release.</p>`,
  },
];

try {
  const existing = await prisma.workspace.findUnique({ where: { slug: "product-studio-demo" } });
  if (existing) {
    console.log(`Sample workspace already exists (${existing.id}); no data was changed.`);
    process.exitCode = 0;
  } else {
    const owner = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } });
    if (!owner) throw new Error("Create an account in CollabSpace before adding the sample workspace.");

    await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: "Product Studio",
          slug: "product-studio-demo",
          icon: "🚀",
          description: "A sample team space with launch notes, customer insights, and a working page history.",
          members: { create: { userId: owner.id, role: "OWNER" } },
        },
      });

      const createdPages = [];
      for (const page of pages) {
        createdPages.push(await tx.document.create({
          data: { ...page, workspaceId: workspace.id, createdById: owner.id },
        }));
      }

      const launchPage = createdPages[0];
      await tx.commentThread.create({
        data: {
          documentId: launchPage.id,
          authorId: owner.id,
          position: "launch-goals",
          comments: { create: [
            { authorId: owner.id, content: "Should we confirm the launch date before we send the announcement?" },
            { authorId: owner.id, content: "Yes. I added that to this week's checklist." },
          ] },
        },
      });

      await tx.documentSnapshot.create({
        data: {
          documentId: launchPage.id,
          versionNumber: 1,
          title: "Version 1 · Initial outline",
          description: "First saved launch outline",
          snapshotJson: JSON.stringify({
            title: "Product launch brief",
            content: "<h1>Product launch brief</h1><p>Plan the launch of the next release.</p><h2>Goals</h2><p>Reach trial teams, improve onboarding, and learn from design partners.</p>",
          }),
          createdById: owner.id,
        },
      });

      console.log(`Created Product Studio with ${createdPages.length} pages, a comment thread, and a restorable snapshot for ${owner.name} (${owner.email}).`);
    });
  }
} finally {
  await prisma.$disconnect();
}
