const { spawn } = require("node:child_process");
const path = require("node:path");

const shimPath = path.join(__dirname, "tsx-os-compat.cjs");
const cliPath = path.join(__dirname, "node_modules", "tsx", "dist", "cli.mjs");
const preload = `--require="${shimPath.replaceAll("\\", "/")}"`;
const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, preload].filter(Boolean).join(" "),
};

const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
  cwd: __dirname,
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("Could not start the TypeScript runner:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
