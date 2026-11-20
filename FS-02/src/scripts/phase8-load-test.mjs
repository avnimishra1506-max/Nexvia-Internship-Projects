import "dotenv/config";
import { performance } from "node:perf_hooks";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const args = parseArgs(process.argv.slice(2));
const apiUrl = (args["api-url"] || process.env.LOAD_TEST_API_URL || "http://localhost:4000").replace(/\/$/, "");
const wsUrl = (args["ws-url"] || process.env.LOAD_TEST_WS_URL || "ws://localhost:1234").replace(/\/$/, "");
const editorCount = integerArg(args.editors, 25, 1, 250, "--editors");
const pageCount = integerArg(args.pages, 1, 1, 20, "--pages");
process.setMaxListeners(Math.max(process.getMaxListeners(), editorCount + 10));
const source = String(args.source || "wikipedia").toLowerCase();
const timeoutMs = integerArg(args.timeout, 30_000, 2_000, 120_000, "--timeout");
const apiOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const email = process.env.LOAD_TEST_EMAIL || process.env.DEMO_EMAIL || "alex@example.test";
const password = process.env.LOAD_TEST_PASSWORD || process.env.DEMO_PASSWORD;

if (args.help) {
  console.log(`Phase 8 collaborative editor load test

Usage: npm run stress -- [options]

Options:
  --editors <count>     Concurrent editor clients (default 25, max 250)
  --pages <count>       Temporary pages to populate (default 1, max 20)
  --source <name>       wikipedia or gutenberg (default wikipedia)
  --api-url <url>       API base URL (default http://localhost:4000)
  --ws-url <url>        Yjs WebSocket base URL (default ws://localhost:1234)
  --timeout <ms>        Per-stage timeout (default 30000)

Uses LOAD_TEST_EMAIL / LOAD_TEST_PASSWORD, or DEMO_PASSWORD with alex@example.test.
The script creates a temporary workspace, then deletes it when finished.`);
  process.exit(0);
}
if (!password) throw new Error("Set DEMO_PASSWORD or LOAD_TEST_PASSWORD in the root .env file.");
if (!new Set(["wikipedia", "gutenberg"]).has(source)) throw new Error("--source must be wikipedia or gutenberg.");

const startedAt = performance.now();
const apiTimings = [];
const clients = [];
let cookie;
let workspaceId;
let successfulEdits = 0;
let failedEdits = 0;
let finalTextBytes = 0;
let sampleInfo;

function parseArgs(tokens) {
  const result = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--help" || token === "-h") { result.help = true; continue; }
    if (!token.startsWith("--")) throw new Error(`Unknown argument: ${token}`);
    const key = token.slice(2);
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Expected a value after ${token}.`);
    result[key] = value;
    index += 1;
  }
  return result;
}

function integerArg(value, fallback, min, max, label) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

async function api(path, { method = "GET", body } = {}) {
  const start = performance.now();
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  apiTimings.push(performance.now() - start);
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(`${method} ${path} returned HTTP ${response.status}: ${detail}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function loadSample() {
  try {
    if (source === "wikipedia") {
      const title = String(args.title || "Collaborative_software").replaceAll(" ", "_");
      const url = new URL("https://en.wikipedia.org/w/api.php");
      url.search = new URLSearchParams({ action: "query", prop: "extracts", exintro: "1", explaintext: "1", format: "json", titles: title }).toString();
      const response = await fetch(url, { headers: { "user-agent": "CollabWorkspacePhase8LoadTest/1.0 (local development test)" }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}.`);
      const data = await response.json();
      const page = Object.values(data.query?.pages || {})[0];
      if (!page?.extract) throw new Error(`Wikipedia returned no extract for “${title}”.`);
      return { title: page.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`, text: page.extract.trim() };
    }

    const response = await fetch("https://www.gutenberg.org/cache/epub/11/pg11.txt", {
      headers: { "user-agent": "CollabWorkspacePhase8LoadTest/1.0 (local development test)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Project Gutenberg returned HTTP ${response.status}.`);
    const book = await response.text();
    const bodyMatch = book.match(/\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*([\s\S]*?)\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i);
    const text = (bodyMatch?.[1] || book).replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
    return { title: "Alice’s Adventures in Wonderland (Project Gutenberg eBook 11)", url: "https://www.gutenberg.org/ebooks/11", text: text.slice(0, 12_000) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Sample download unavailable (${reason}); using the built-in Project Gutenberg excerpt.`);
    return {
      title: "Alice’s Adventures in Wonderland (offline Project Gutenberg excerpt)",
      url: "https://www.gutenberg.org/ebooks/11",
      text: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, and what is the use of a book, thought Alice, without pictures or conversations?",
      offline: true,
    };
  }
}

function waitForProvider(provider, eventName, predicate, description) {
  return new Promise((resolve, reject) => {
    let lastStatus = provider.wsconnected ? "connected" : "connecting";
    let lastClose = "";
    const onStatus = ({ status }) => { lastStatus = status; };
    const onError = () => { lastClose = "WebSocket connection error"; };
    provider.on("status", onStatus);
    provider.on("connection-error", onError);
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${description} (status: ${lastStatus}, synced: ${provider.synced}${lastClose ? `, ${lastClose}` : ""}).`));
    }, timeoutMs);
    const onEvent = (value) => {
      if (!predicate(value)) return;
      cleanup();
      resolve(value);
    };
    const onClose = (event) => {
      cleanup();
      reject(new Error(`WebSocket closed before ${description}${event?.reason ? `: ${event.reason}` : ""}.`));
    };
    function cleanup() {
      clearTimeout(timeout);
      provider.off(eventName, onEvent);
      provider.off("connection-close", onClose);
      provider.off("status", onStatus);
      provider.off("connection-error", onError);
    }
    provider.on(eventName, onEvent);
    provider.on("connection-close", onClose);
  });
}

function waitUntil(predicate, description) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() >= deadline) return reject(new Error(`Timed out waiting for ${description}.`));
      setTimeout(tick, 20);
    };
    tick();
  });
}

function makeClient(pageId, index) {
  const doc = new Y.Doc();
  const AuthWebSocket = class extends WebSocket {
    constructor(url, protocols) {
      super(url, protocols, { headers: { cookie, origin: apiOrigin } });
    }
  };
  const provider = new WebsocketProvider(wsUrl, `page:${pageId}`, doc, {
    WebSocketPolyfill: AuthWebSocket,
    disableBc: true,
    maxBackoffTime: 1_000,
  });
  provider.awareness.setLocalStateField("user", {
    name: `Load editor ${index + 1}`,
    color: `hsl(${(index * 137.5) % 360} 55% 45%)`,
  });
  const synced = provider.synced
    ? Promise.resolve(performance.now())
    : waitForProvider(provider, "sync", (value) => value === true, `editor ${index + 1} to sync`).then(() => performance.now());
  return { doc, provider, synced, pageId, index, syncedAt: 0 };
}

function paragraphText(doc) {
  const paragraph = doc.getXmlFragment("default").toArray()[0];
  const text = paragraph?.toArray().find((node) => node instanceof Y.XmlText);
  if (!(text instanceof Y.XmlText)) throw new Error("The synchronized page does not contain the expected paragraph.");
  return text;
}

async function main() {
  sampleInfo = await loadSample();
  console.log(`Sample: ${sampleInfo.title} (${sampleInfo.text.length.toLocaleString()} characters)`);
  console.log(`Source: ${sampleInfo.url}${sampleInfo.offline ? " (built-in offline excerpt)" : ""}`);
  console.log(`Target: ${apiUrl} + ${wsUrl}; editors: ${editorCount}; pages: ${pageCount}`);

  const loginResponse = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginResponse.ok) throw new Error(`Login failed with HTTP ${loginResponse.status}; check LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD/DEMO_PASSWORD.`);
  const setCookie = loginResponse.headers.get("set-cookie") || "";
  const cookieMatch = setCookie.match(/(?:^|,\s*)collab_session=([^;]+)/);
  if (!cookieMatch) throw new Error("Login succeeded but did not return the collab_session cookie.");
  cookie = `collab_session=${cookieMatch[1]}`;

  const workspace = await api("/api/workspaces", { method: "POST", body: { name: `Phase 8 load run ${new Date().toISOString()}` } });
  workspaceId = workspace.workspace.id;
  const pageIds = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const result = await api(`/api/workspaces/${workspaceId}/pages`, {
      method: "POST",
      body: { title: `Load sample ${pageIndex + 1}: ${sampleInfo.title.slice(0, 140)}` },
    });
    pageIds.push(result.page.id);
  }

  const connectStarted = performance.now();
  for (let index = 0; index < editorCount; index += 1) {
    const pageId = pageIds[index % pageIds.length];
    clients.push(makeClient(pageId, index));
  }
  await Promise.all(clients.map(async (client) => { client.syncedAt = await client.synced; }));
  const syncElapsedMs = performance.now() - connectStarted;
  const connectLatencies = clients.map((client) => client.syncedAt - connectStarted).sort((a, b) => a - b);

  const perPage = new Map(pageIds.map((id) => [id, []]));
  for (const client of clients) perPage.get(client.pageId).push(client);
  for (const [pageId, pageClients] of perPage) {
    await waitUntil(() => pageClients.every((client) => {
      const visibleNames = [...client.provider.awareness.getStates().values()].map((state) => state.user?.name);
      return pageClients.every((peer) => visibleNames.includes(`Load editor ${peer.index + 1}`));
    }), `all ${pageClients.length} editor cursors to become visible on ${pageId}`);
    const owner = pageClients[0];
    const fragment = owner.doc.getXmlFragment("default");
    const paragraph = new Y.XmlElement("paragraph");
    const textNode = new Y.XmlText();
    textNode.insert(0, sampleInfo.text);
    paragraph.insert(0, [textNode]);
    fragment.insert(0, [paragraph]);
    await waitUntil(() => pageClients.every((client) => {
      const current = client.doc.getXmlFragment("default").toArray()[0]?.toArray().find((node) => node instanceof Y.XmlText);
      return current instanceof Y.XmlText && current.toString() === sampleInfo.text;
    }), `sample text to sync to all ${pageClients.length} editors on ${pageId}`);
  }

  const editStarted = performance.now();
  for (const client of clients) {
    const text = paragraphText(client.doc);
    const edit = `\n[simulated editor ${String(client.index + 1).padStart(3, "0")}] `;
    try {
      text.insert(text.length, edit);
      successfulEdits += 1;
    } catch {
      failedEdits += 1;
    }
  }
  for (const [pageId, pageClients] of perPage) {
    const expectedMarkers = pageClients.map((client) => `[simulated editor ${String(client.index + 1).padStart(3, "0")}]`);
    await waitUntil(() => pageClients.every((client) => {
      const finalText = paragraphText(client.doc).toString();
      return expectedMarkers.every((marker) => finalText.includes(marker));
    }), `concurrent edits to converge on ${pageId}`);
  }
  const editElapsedMs = performance.now() - editStarted;
  finalTextBytes = clients.reduce((sum, client) => sum + Buffer.byteLength(paragraphText(client.doc).toString()), 0);

  for (const client of clients) {
    client.provider.destroy();
    client.doc.destroy();
  }
  clients.length = 0;
  await new Promise((resolve) => setTimeout(resolve, 600));
  const mem = process.memoryUsage();
  console.log("\nPhase 8 load report");
  console.log(`  Concurrent editors: ${editorCount}`);
  console.log(`  Temporary pages: ${pageCount}`);
  console.log(`  Editors synchronized: ${editorCount}/${editorCount} in ${syncElapsedMs.toFixed(1)} ms`);
  console.log(`  Connect latency p50/p95/max: ${percentile(connectLatencies, 0.50).toFixed(1)} / ${percentile(connectLatencies, 0.95).toFixed(1)} / ${Math.max(...connectLatencies).toFixed(1)} ms`);
  console.log(`  Cursor presence: all ${editorCount} virtual editors visible to peers`);
  console.log(`  Concurrent edits converged: ${successfulEdits - failedEdits}/${editorCount} edits in ${editElapsedMs.toFixed(1)} ms`);
  console.log(`  Synchronized document bytes across clients: ${finalTextBytes.toLocaleString()}`);
  const sortedApiTimings = apiTimings.slice().sort((a, b) => a - b);
  console.log(`  API request latency p50/p95: ${percentile(sortedApiTimings, 0.50).toFixed(1)} / ${percentile(sortedApiTimings, 0.95).toFixed(1)} ms`);
  console.log(`  Load generator memory (RSS / heap): ${(mem.rss / 1024 / 1024).toFixed(1)} / ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MiB`);
  console.log(`  Total run time: ${((performance.now() - startedAt) / 1000).toFixed(2)} s`);
  console.log("  Note: this is a local functional/load smoke test, not a production capacity benchmark.");
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
}

try {
  await main();
} catch (error) {
  console.error(`\nLoad test failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  for (const client of clients) {
    client.provider.destroy();
    client.doc.destroy();
  }
  if (workspaceId && cookie) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await api(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
      console.log("Temporary load-test workspace cleaned up.");
    } catch (error) {
      console.error(`Could not clean up temporary workspace ${workspaceId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
