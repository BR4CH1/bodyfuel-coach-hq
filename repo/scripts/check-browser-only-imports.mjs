import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "src");
const browserOnlyPackages = [
  "@stripe/react-stripe-js",
  "@stripe/stripe-js",
  "@zxing/browser",
  "@zxing/library",
  "html-to-image",
  "jszip",
  "react-easy-crop",
  "recharts",
];

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const violations = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath);
      continue;
    }
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    inspectFile(absolutePath);
  }
}

function inspectFile(absolutePath) {
  const relativePath = path.relative(process.cwd(), absolutePath).replaceAll(path.sep, "/");
  if (/\.client\.[cm]?[jt]sx?$/.test(relativePath)) return;

  const source = fs.readFileSync(absolutePath, "utf8");
  const staticImport = /^\s*import\s+(?!type\b)[\s\S]*?\s+from\s+["']([^"']+)["'];?/gm;

  for (const match of source.matchAll(staticImport)) {
    const specifier = match[1];
    if (!browserOnlyPackages.includes(specifier)) continue;
    const line = source.slice(0, match.index).split("\n").length;
    violations.push(`${relativePath}:${line} statischer Import von ${specifier}`);
  }
}

walk(root);

if (violations.length > 0) {
  console.error(
    "Browser-only-Abhängigkeiten dürfen außerhalb von *.client.* nur dynamisch importiert werden:",
  );
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Browser-only-Import-Guard bestanden.");
