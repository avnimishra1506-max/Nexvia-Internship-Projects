import "dotenv/config";
import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { WebSocketServer } from "ws";
import Redis from "ioredis";
import { setupWSConnection, getYDoc, docs } from "y-websocket/bin/utils";

// Keep the same Yjs instance as y-websocket's CommonJS server utilities.
const require = createRequire(import.meta.url);
const Y = require("yjs");
const decoding = require("lib0/decoding");
const PORT = Number.parseInt(process.env.PORT || "1234", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const TOKEN_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
const prisma = new PrismaClient();

if (!TOKEN_SECRET || TOKEN_SECRET.length < 32) {
  throw new Error("Set JWT_SECRET or SESSION_SECRET to at least 32 characters before starting the WebSocket server.");
}

let redisPublisher = null;
let redisSubscriber = null;
try {
  redisPublisher = new Redis(REDIS_URL, { lazyConnect: true, retryStrategy: () => null });
  redisSubscriber = new Redis(REDIS_URL, { lazyConnect: true, retryStrategy: () => null });
  redisPublisher.on("error", () => { redisPublisher = null; });
  redisSubscriber.on("error", () => { redisSubscriber = null; });
  redisPublisher.connect().then(() => {
    console.log("[Redis] Publisher connected; multi-node updates enabled.");
  }).catch(() => {
    redisPublisher = null;
    console.log("[Redis] Publisher unavailable; continuing in single-node mode.");
  });
  redisSubscriber.connect().then(() => {
    redisSubscriber?.subscribe("yjs:doc-updates").catch(() => {});
    console.log("[Redis] Subscriber connected; listening for shared updates.");
    redisSubscriber?.on("message", (channel, message) => {
      if (channel !== "yjs:doc-updates") return;
      try {
        const { docName, updateBase64 } = JSON.parse(message);
        const doc = getYDoc(docName, false);
        if (doc) Y.applyUpdate(doc, Buffer.from(updateBase64, "base64"), "redis");
      } catch (error) {
        console.error("[Redis] Error applying cross-node update:", error);
      }
    });
  }).catch(() => {
    redisSubscriber = null;
    console.log("[Redis] Subscriber unavailable; continuing in single-node mode.");
  });
} catch {
  console.log("[Redis] Running in standalone single-instance mode.");
}

function readCookie(request, name) {
  for (const entry of (request.headers.cookie || "").split(";")) {
    const [key, ...parts] = entry.trim().split("=");
    if (key === name) {
      try { return decodeURIComponent(parts.join("=")); } catch { return undefined; }
    }
  }
  return undefined;
}

function verifyToken(token) {
  const parts = token?.split(".");
  if (!parts || parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = createHmac("sha256", TOKEN_SECRET).update(payload).digest();
  let provided;
  try { provided = Buffer.from(parts[2], "base64url"); } catch { return null; }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof data.sub === "string" && typeof data.exp === "number" && data.exp > Date.now() / 1000 ? data.sub : null;
  } catch { return null; }
}

const initializedRooms = new Set();
const initializingRooms = new Map();
const observedDocs = new WeakSet();
const persistTimers = new Map();
const persistQueues = new Map();

function addAccessControlledMessageFilter(connection, pageId, userId) {
  const addListener = connection.on.bind(connection);
  let cachedRole = null;
  let checkedAt = 0;
  let messageQueue = Promise.resolve();
  async function getCurrentRole() {
    if (Date.now() - checkedAt < 1000) return cachedRole;
    const access = await prisma.page.findUnique({
      where: { id: pageId },
      select: {
        workspace: { select: { members: { where: { userId }, select: { role: true } } } },
        permissions: { where: { userId }, select: { role: true } },
      },
    });
    const membership = access?.workspace.members[0];
    cachedRole = membership ? access.permissions[0]?.role ?? (membership.role === "VIEWER" ? "VIEW" : "EDIT") : null;
    checkedAt = Date.now();
    return cachedRole;
  }
  connection.on = (event, listener) => {
    if (event !== "message") return addListener(event, listener);
    return addListener(event, (data, isBinary) => {
      messageQueue = messageQueue.then(async () => {
        try {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const messageType = decoding.readVarUint(decoder);
        const messageSubtype = messageType === 0 ? decoding.readVarUint(decoder) : null;
        const role = await getCurrentRole();
        if (!role) return connection.close(1008, "Page access was revoked.");
        // Read and comment access can request server state and publish awareness,
        // but cannot send a document state or incremental document update.
        if (messageType === 0 && messageSubtype !== 0 && role !== "EDIT") return;
        listener(data, isBinary);
        } catch (error) {
          console.error("[WS] Rejected collaboration message:", error);
          connection.close(1003, "Invalid collaboration message.");
        }
      });
    });
  };
}

function persistRoom(pageId, doc) {
  const state = Buffer.from(Y.encodeStateAsUpdate(doc));
  const previous = persistQueues.get(pageId) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => prisma.page.update({
    where: { id: pageId },
    data: { yjsState: state },
  }));
  persistQueues.set(pageId, next);
  next.catch((error) => console.error(`[DB] Could not persist page ${pageId}:`, error));
  return next;
}

function observeRoom(pageId, doc) {
  if (observedDocs.has(doc)) return;
  observedDocs.add(doc);
  doc.on("update", (update, origin) => {
    if (origin !== "redis" && redisPublisher?.status === "ready") {
      redisPublisher.publish("yjs:doc-updates", JSON.stringify({
        docName: doc.name,
        updateBase64: Buffer.from(update).toString("base64"),
      })).catch(() => {});
    }
    clearTimeout(persistTimers.get(pageId));
    persistTimers.set(pageId, setTimeout(() => {
      persistTimers.delete(pageId);
      void persistRoom(pageId, doc);
    }, 300));
  });
}

async function getPageRoom(pageId) {
  if (initializedRooms.has(pageId)) return getYDoc(`page:${pageId}`, true);
  if (initializingRooms.has(pageId)) return initializingRooms.get(pageId);

  const initialization = (async () => {
    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { yjsState: true } });
    if (!page) throw new Error("Page no longer exists.");
    const roomName = `page:${pageId}`;
    const doc = getYDoc(roomName, true);
    if (page.yjsState?.length) Y.applyUpdate(doc, page.yjsState, "database");
    initializedRooms.add(pageId);
    observeRoom(pageId, doc);
    return doc;
  })();
  initializingRooms.set(pageId, initialization);
  try { return await initialization; }
  finally { initializingRooms.delete(pageId); }
}

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({
    status: "online",
    server: "Collab Workspace Yjs WebSocket Server",
    activeRooms: docs.size,
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  }));
});

const websocketServer = new WebSocketServer({ server });
websocketServer.on("connection", async (connection, request) => {
  // Authentication and page loading await the database. Buffer the client's
  // first Yjs sync messages during that work so the initial sync step is not lost.
  const earlyMessages = [];
  let earlyMessageBytes = 0;
  const captureEarlyMessage = (data, isBinary) => {
    const byteLength = data?.byteLength ?? data?.length ?? 0;
    if (earlyMessages.length >= 32 || earlyMessageBytes + byteLength > 1_048_576) {
      connection.close(1009, "Too many messages before page authorization completed.");
      return;
    }
    earlyMessages.push([data, isBinary]);
    earlyMessageBytes += byteLength;
  };
  connection.on("message", captureEarlyMessage);
  const reject = (message) => connection.close(1008, message);
  try {
    if (request.headers.origin && request.headers.origin !== CORS_ORIGIN) return reject("Origin not allowed.");
    const userId = verifyToken(readCookie(request, "collab_session"));
    if (!userId) return reject("Please sign in to collaborate.");

    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    const match = url.pathname.match(/^\/page:([A-Za-z0-9_-]{1,64})$/);
    if (!match) return reject("Invalid page room.");
    const pageId = match[1];
    const pageAccess = await prisma.page.findUnique({
      where: { id: pageId },
      select: {
        workspace: { select: { members: { where: { userId }, select: { role: true } } } },
        permissions: { where: { userId }, select: { role: true } },
      },
    });
    const membership = pageAccess?.workspace.members[0];
    if (!membership) return reject("You are not a member of this workspace.");
    const pageRole = pageAccess.permissions[0]?.role ?? (membership.role === "VIEWER" ? "VIEW" : "EDIT");

    const doc = await getPageRoom(pageId);
    addAccessControlledMessageFilter(connection, pageId, userId);
    setupWSConnection(connection, request, { docName: `page:${pageId}`, gc: true });
    connection.off("message", captureEarlyMessage);
    for (const [data, isBinary] of earlyMessages) connection.emit("message", data, isBinary);
    console.log(`[WS] User ${userId} joined page ${pageId} (${pageRole}).`);
  } catch (error) {
    console.error("[WS] Could not authorize or initialize room:", error);
    reject("Could not open this page for collaboration.");
  }
});

server.listen(PORT, () => {
  console.log(`[WS] Yjs WebSocket server listening on port ${PORT}.`);
  console.log(`[WS] Endpoint: ws://localhost:${PORT}/page:<page-id>`);
});

async function shutdown() {
  websocketServer.close();
  server.close();
  for (const [pageId, timer] of persistTimers) {
    clearTimeout(timer);
    const doc = docs.get(`page:${pageId}`);
    if (doc) void persistRoom(pageId, doc);
  }
  await Promise.allSettled([...persistQueues.values()]);
  await Promise.allSettled([redisPublisher?.quit(), redisSubscriber?.quit()]);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
