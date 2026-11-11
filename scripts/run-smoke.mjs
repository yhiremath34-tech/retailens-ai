#!/usr/bin/env node
import { spawn } from "node:child_process";

const PORT = "3107";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const isWin = process.platform === "win32";

async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {
      // Server still booting
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error("Timed out waiting for Next.js server /api/health");
}

async function run() {
  const server = spawn(
    isWin ? "cmd.exe" : "npx",
    isWin ? ["/c", "npx", "next", "start", "-p", PORT, "-H", "127.0.0.1"] : ["next", "start", "-p", PORT, "-H", "127.0.0.1"],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  let logs = "";
  server.stdout.on("data", (d) => {
    logs += d.toString();
  });
  server.stderr.on("data", (d) => {
    logs += d.toString();
  });

  try {
    await waitForHealth();
    const verifier = spawn("node", ["scripts/verify-api.mjs", "--base-url", BASE_URL], {
      stdio: "inherit",
    });
    const code = await new Promise((resolve) => verifier.on("close", resolve));
    if (code !== 0) {
      throw new Error(`verify-api exited with code ${code}`);
    }
  } catch (err) {
    console.error("Server logs:\n", logs);
    throw err;
  } finally {
    if (isWin && server.pid) {
      spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      server.kill("SIGTERM");
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

