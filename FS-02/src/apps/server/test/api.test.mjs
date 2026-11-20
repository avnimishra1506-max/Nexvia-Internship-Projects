import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
const { app, prisma } = await import("../dist/apps/server/src/index.js");
let server;
let base;
const createdUserIds = [];

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const userId of createdUserIds) {
    await prisma.workspace.deleteMany({ where: { members: { some: { userId } } } });
    await prisma.page.deleteMany({ where: { createdById: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

async function call(route, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie");
  return {
    status: response.status,
    cookie: setCookie?.split(";")[0] ?? cookie,
    data: response.status === 204 ? undefined : await response.json(),
  };
}

test("authentication, workspace/page CRUD, invite roles, and validation", async () => {
  assert.equal((await call("/api/health")).status, 200);
  assert.equal((await call("/api/workspaces")).status, 401);

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const password = "Test-Password-Only-9281";
  const owner = await call("/api/auth/register", {
    method: "POST", body: { name: "API Test Owner", email: `owner-${suffix}@example.test`, password },
  });
  assert.equal(owner.status, 201);
  createdUserIds.push(owner.data.user.id);
  assert.ok(owner.cookie, "register should set an httpOnly session cookie");
  assert.equal((await call("/api/auth/me", { cookie: owner.cookie })).data.user.name, "API Test Owner");
  assert.equal((await call("/api/workspaces", { method: "POST", body: { name: "" }, cookie: owner.cookie })).status, 400);

  const viewer = await call("/api/auth/register", {
    method: "POST", body: { name: "API Test Viewer", email: `viewer-${suffix}@example.test`, password },
  });
  assert.equal(viewer.status, 201);
  createdUserIds.push(viewer.data.user.id);

  const createdWorkspace = await call("/api/workspaces", { method: "POST", body: { name: "API Test Space" }, cookie: owner.cookie });
  assert.equal(createdWorkspace.status, 201);
  const workspaceId = createdWorkspace.data.workspace.id;
  let listed = await call(`/api/workspaces/${workspaceId}/pages`, { cookie: owner.cookie });
  assert.equal(listed.status, 200);
  assert.equal(listed.data.pages.length, 1, "new workspace includes a welcome page");

  const parent = await call(`/api/workspaces/${workspaceId}/pages`, { method: "POST", body: { title: "Parent" }, cookie: owner.cookie });
  assert.equal(parent.status, 201);
  const child = await call(`/api/workspaces/${workspaceId}/pages`, { method: "POST", body: { title: "Child", parentId: parent.data.page.id }, cookie: owner.cookie });
  assert.equal(child.data.page.parentId, parent.data.page.id);
  assert.equal((await call(`/api/pages/${parent.data.page.id}`, { method: "PATCH", body: { parentId: child.data.page.id }, cookie: owner.cookie })).status, 400, "cyclic nesting is rejected");
  assert.equal((await call(`/api/pages/${child.data.page.id}`, { method: "PATCH", body: { title: "Renamed child" }, cookie: owner.cookie })).data.page.title, "Renamed child");

  assert.equal((await call(`/api/workspaces/${workspaceId}/members`, {
    method: "POST", body: { email: viewer.data.user.email, role: "VIEWER" }, cookie: owner.cookie,
  })).status, 201);
  const viewerLogin = await call("/api/auth/login", { method: "POST", body: { email: viewer.data.user.email, password } });
  assert.equal(viewerLogin.status, 200);
  assert.equal((await call(`/api/workspaces/${workspaceId}/pages`, { cookie: viewerLogin.cookie })).status, 200);
  assert.equal((await call(`/api/workspaces/${workspaceId}/pages`, { method: "POST", body: { title: "Nope" }, cookie: viewerLogin.cookie })).status, 403);
  assert.equal((await call(`/api/pages/${parent.data.page.id}`, { method: "PATCH", body: { title: "Nope" }, cookie: viewerLogin.cookie })).status, 403);
  assert.equal((await call(`/api/workspaces/${workspaceId}`, { method: "PATCH", body: { name: "Nope" }, cookie: viewerLogin.cookie })).status, 403);

  assert.equal((await call(`/api/workspaces/${workspaceId}`, { method: "PATCH", body: { name: "Renamed Test Space" }, cookie: owner.cookie })).status, 200);
  assert.equal((await call(`/api/pages/${parent.data.page.id}`, { method: "DELETE", cookie: owner.cookie })).status, 204);
  assert.equal((await call(`/api/workspaces/${workspaceId}`, { method: "DELETE", cookie: owner.cookie })).status, 204);
  assert.equal((await call("/api/auth/logout", { method: "POST", cookie: owner.cookie })).status, 204);
  assert.equal((await call("/api/auth/me")).status, 401);
});
