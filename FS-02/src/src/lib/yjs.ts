import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export interface YjsClientInstance {
  doc: Y.Doc;
  provider: WebsocketProvider | null;
}

export function createYjsDoc(roomName: string): Y.Doc {
  return new Y.Doc({ guid: roomName });
}

export function getWebSocketUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_WS_URL || `ws://${window.location.hostname}:1234`;
  }
  return process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:1234";
}

export function createWebsocketProvider(roomName: string, doc: Y.Doc): WebsocketProvider | null {
  if (typeof window === "undefined") return null;

  try {
    const wsUrl = getWebSocketUrl();
    const provider = new WebsocketProvider(wsUrl, roomName, doc, {
      connect: true,
    });
    return provider;
  } catch (err) {
    console.warn("[Yjs] Websocket provider initialization failed, using local in-memory doc:", err);
    return null;
  }
}

