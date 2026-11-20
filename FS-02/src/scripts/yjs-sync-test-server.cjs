const { createServer } = require("node:http");
const { WebSocketServer } = require("ws");
const { setupWSConnection } = require("y-websocket/bin/utils");

const server = createServer();
const websocketServer = new WebSocketServer({ server });
websocketServer.on("connection", (socket, request) => {
  const room = new URL(request.url || "/", "http://localhost").pathname.slice(1);
  setupWSConnection(socket, request, { docName: room, gc: true });
});

server.listen(0, "127.0.0.1", () => {
  process.stdout.write(`PORT:${server.address().port}\n`);
});

process.on("SIGTERM", () => {
  websocketServer.close();
  server.close(() => process.exit(0));
});
