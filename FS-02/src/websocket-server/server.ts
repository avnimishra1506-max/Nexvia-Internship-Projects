/**
 * Real-time WebSocket Server for Yjs Collaborative Workspace
 * Standalone server handling real-time synchronization, cursor presence, and Redis clustering.
 */

import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import * as Y from "yjs";
// @ts-ignore - y-websocket binary utilities
import { setupWSConnection, getYDoc, docs } from "y-websocket/bin/utils";
import Redis from "ioredis";

const PORT = parseInt(process.env.PORT || "1234", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Optional Redis Pub/Sub for horizontal scaling across instances
let redisPublisher: Redis | null = null;
let redisSubscriber: Redis | null = null;

try {
  redisPublisher = new Redis(REDIS_URL, {
    lazyConnect: true,
    retryStrategy: () => null,
  });
  redisSubscriber = new Redis(REDIS_URL, {
    lazyConnect: true,
    retryStrategy: () => null,
  });

  redisPublisher.on("error", () => {
    redisPublisher = null;
  });

  redisSubscriber.on("error", () => {
    redisSubscriber = null;
  });

  redisPublisher.connect().then(() => {
    console.log(`[Redis] Publisher connected for multi-node horizontal scaling.`);
  }).catch(() => {
    console.log(`[Redis] Single node mode: Local in-memory sync active.`);
    redisPublisher = null;
  });

  redisSubscriber.connect().then(() => {
    redisSubscriber?.subscribe("yjs:doc-updates", () => {
      console.log(`[Redis] Subscribed to yjs:doc-updates channel.`);
    });

    redisSubscriber?.on("message", (channel, message) => {
      if (channel === "yjs:doc-updates") {
        try {
          const { docName, updateBase64 } = JSON.parse(message);
          const doc = getYDoc(docName, false);
          if (doc) {
            const update = Buffer.from(updateBase64, "base64");
            Y.applyUpdate(doc, update, "redis");
          }
        } catch (err) {
          console.error("[Redis] Error parsing cross-pod update:", err);
        }
      }
    });
  }).catch(() => {
    redisSubscriber = null;
  });
} catch {
  console.log(`[Redis] Running in standalone single-instance mode.`);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "online",
      server: "Collab-Workspace Yjs WebSocket Cluster",
      activeRooms: docs.size,
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  );
});

const wss = new WebSocketServer({ server });

wss.on("connection", (conn: WebSocket, req: http.IncomingMessage) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const docName = url.pathname.replace(/^\//, "") || "default-document";

  // Official y-websocket connection setup with awareness & CRDT sync
  setupWSConnection(conn, req, { docName, gc: true });

  const doc = getYDoc(docName, true);

  // Hook into document updates to broadcast to Redis if clustered
  doc.on("update", (update: Uint8Array, origin: any) => {
    if (origin !== "redis" && redisPublisher && redisPublisher.status === "ready") {
      const updateBase64 = Buffer.from(update).toString("base64");
      redisPublisher.publish(
        "yjs:doc-updates",
        JSON.stringify({ docName, updateBase64 })
      ).catch(() => {});
    }
  });

  console.log(`[WS] Peer connected to room '${docName}'.`);
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Real-time Yjs WebSocket Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/<docName>`);
  console.log(`📊 Health check: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});

