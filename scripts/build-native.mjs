import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const nativeDir = join(root, "native-dist");
const serverOrigin =
  process.env.VITE_APP_SERVER_ORIGIN || "https://bodyfuel-coaching.com";

const result = spawnSync(
  process.execPath,
  ["--max-old-space-size=4096", "./node_modules/vite/bin/vite.js", "build"],
  {
    cwd: root,
    env: {
      ...process.env,
      BF_NATIVE_APP: "1",
      BF_DISABLE_MCP: "1",
      VITE_NATIVE_APP: "1",
      VITE_APP_SERVER_ORIGIN: serverOrigin,
    },
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const candidates = [".output/public", "dist/client", "dist"];
const sourceDir = candidates.find(
  (candidate) =>
    existsSync(join(root, candidate, "_shell.html")) ||
    existsSync(join(root, candidate, "index.html")),
);

if (!sourceDir) {
  console.error(
    `Native build failed: no SPA shell found in ${candidates.join(", ")}.`,
  );
  process.exit(1);
}

const absoluteSource = join(root, sourceDir);
rmSync(nativeDir, { recursive: true, force: true });
mkdirSync(nativeDir, { recursive: true });
cpSync(absoluteSource, nativeDir, { recursive: true });

const shellPath = join(nativeDir, "_shell.html");
const indexPath = join(nativeDir, "index.html");
if (!existsSync(indexPath) && existsSync(shellPath)) {
  cpSync(shellPath, indexPath);
}

if (!existsSync(indexPath)) {
  console.error("Native build failed: native-dist/index.html was not created.");
  process.exit(1);
}

console.log(`Native assets ready: ${sourceDir} -> native-dist`);
console.log(`Native server origin: ${serverOrigin}`);
