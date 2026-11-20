import assert from "node:assert/strict";
import { test } from "node:test";
import { workspaceRoleCanEdit, workspaceRoleCanManage } from "@collab/shared";

test("workspace roles grant the expected edit and management abilities", () => {
  assert.equal(workspaceRoleCanEdit("OWNER"), true);
  assert.equal(workspaceRoleCanEdit("ADMIN"), true);
  assert.equal(workspaceRoleCanEdit("MEMBER"), true);
  assert.equal(workspaceRoleCanEdit("VIEWER"), false);

  assert.equal(workspaceRoleCanManage("OWNER"), true);
  assert.equal(workspaceRoleCanManage("ADMIN"), true);
  assert.equal(workspaceRoleCanManage("MEMBER"), false);
  assert.equal(workspaceRoleCanManage("VIEWER"), false);
});
