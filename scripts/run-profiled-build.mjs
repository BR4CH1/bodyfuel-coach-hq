import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const profileFile = path.resolve(process.cwd(), ".build-profile.jsonl");
fs.rmSync(profileFile, { force: true });

const env = {
  ...process.env,
  BF_BUILD_PROFILE: "1",
  BF_BUILD_PROFILE_FILE: profileFile,
};

if (args.has("--no-mcp")) env.BF_DISABLE_MCP = "1";
if (args.has("--no-pwa")) env.BF_DISABLE_PWA = "1";
if (args.has("--inline-ssr")) env.BF_SSR_INLINE_DYNAMIC_IMPORTS = "1";

const viteBin = path.resolve(process.cwd(), "node_modules/vite/bin/vite.js");
const child = spawn(process.execPath, ["--max-old-space-size=4096", viteBin, "build"], {
  env,
  stdio: "inherit",
});

let terminationSignal;

const forwardSignal = (signal) => {
  terminationSignal = signal;
  if (!child.killed) child.kill(signal);

  const forceKill = setTimeout(() => {
    if (!child.killed) child.kill("SIGKILL");
  }, 3_000);
  forceKill.unref?.();
};

process.once("SIGINT", () => forwardSignal("SIGINT"));
process.once("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  const report = spawn(process.execPath, [path.resolve("scripts/analyze-build-profile.mjs")], {
    stdio: "inherit",
  });

  report.on("exit", () => {
    const finalSignal = signal ?? terminationSignal;
    if (finalSignal) {
      process.removeAllListeners(finalSignal);
      process.kill(process.pid, finalSignal);
      return;
    }
    process.exit(code ?? 1);
  });
});
