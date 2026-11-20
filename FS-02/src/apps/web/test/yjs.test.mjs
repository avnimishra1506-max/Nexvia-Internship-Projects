import assert from "node:assert/strict";
import { test } from "node:test";
import * as Y from "yjs";

test("Yjs local documents converge after concurrent edits and can be restored from state", () => {
  const first = new Y.Doc();
  const second = new Y.Doc();
  first.getText("page").insert(0, "Notes: ");
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));

  const updatesFromFirst = [];
  const updatesFromSecond = [];
  first.on("update", (update) => updatesFromFirst.push(update));
  second.on("update", (update) => updatesFromSecond.push(update));
  first.getText("page").insert(7, "from the first editor ");
  second.getText("page").insert(7, "from the second editor ");

  for (const update of updatesFromFirst) Y.applyUpdate(second, update);
  for (const update of updatesFromSecond) Y.applyUpdate(first, update);
  assert.equal(first.getText("page").toString(), second.getText("page").toString());

  const recovered = new Y.Doc();
  Y.applyUpdate(recovered, Y.encodeStateAsUpdate(first));
  assert.equal(recovered.getText("page").toString(), first.getText("page").toString());

  first.destroy();
  second.destroy();
  recovered.destroy();
});
