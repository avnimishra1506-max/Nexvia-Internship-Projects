import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const serverProcess = spawn(process.execPath, ["scripts/yjs-sync-test-server.cjs"], { stdio: ["ignore", "pipe", "inherit"] });
let startupOutput = "";
const port = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Timed out starting local Yjs test server")), 5000);
  serverProcess.stdout.on("data", (chunk) => {
    startupOutput += chunk.toString();
    const match = startupOutput.match(/PORT:(\d+)/);
    if (match) {
      clearTimeout(timeout);
      resolve(Number(match[1]));
    }
  });
  serverProcess.once("error", reject);
  serverProcess.once("exit", (code) => reject(new Error(`Yjs test server exited (${code})`)));
});

const room = `day3-sync-${Date.now()}`;
const firstDoc = new Y.Doc();
const secondDoc = new Y.Doc();
const first = new WebsocketProvider(`ws://127.0.0.1:${port}`, room, firstDoc);
const second = new WebsocketProvider(`ws://127.0.0.1:${port}`, room, secondDoc);

function waitForSync(provider) {
  if (provider.synced) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for Yjs sync")), 5000);
    provider.on("sync", (synced) => {
      if (!synced) return;
      clearTimeout(timeout);
      resolve();
    });
  });
}

function waitForStatus(provider, expected) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for WebSocket ${expected}`)), 5000);
    const onStatus = ({ status }) => {
      if (status !== expected) return;
      clearTimeout(timeout);
      provider.off("status", onStatus);
      resolve();
    };
    provider.on("status", onStatus);
  });
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 5000;
  while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(predicate(), `Timed out waiting for ${description}`);
}

try {
  await Promise.all([waitForSync(first), waitForSync(second)]);
  const firstText = firstDoc.getText("concurrent-text");
  const secondText = secondDoc.getText("concurrent-text");
  first.awareness.setLocalStateField("user", { name: "Peer One", color: "#ef4444" });
  second.awareness.setLocalStateField("user", { name: "Peer Two", color: "#2563eb" });
  await waitFor(() => [...first.awareness.getStates().values()].some((state) => state.user?.name === "Peer Two"), "peer presence to reach client one");
  await waitFor(() => [...second.awareness.getStates().values()].some((state) => state.user?.name === "Peer One"), "peer presence to reach client two");

  firstText.insert(0, "baseline ");
  await waitFor(() => secondText.toString() === "baseline ", "initial update to reach peer two");

  // Both peers insert at the same position before either receives the other update.
  firstText.insert(0, "Alpha ");
  secondText.insert(0, "Beta ");
  await waitFor(() => firstText.toString() === secondText.toString(), "concurrent edits to converge");

  assert.equal(firstText.toString(), secondText.toString(), "both replicas should converge");
  assert.match(firstText.toString(), /Alpha/);
  assert.match(firstText.toString(), /Beta/);

  const disconnected = waitForStatus(first, "disconnected");
  first.disconnect();
  await disconnected;
  secondText.insert(0, "reconnect ");
  first.connect();
  await waitFor(() => first.synced && firstText.toString() === secondText.toString(), "reconnected client to catch up");
  assert.match(firstText.toString(), /reconnect/);
  console.log(`Two peers shared presence, converged after concurrent edits, and recovered after reconnect: ${JSON.stringify(firstText.toString())}`);
} finally {
  first.destroy();
  second.destroy();
  firstDoc.destroy();
  secondDoc.destroy();
  serverProcess.kill("SIGTERM");
  await once(serverProcess, "exit");
}
