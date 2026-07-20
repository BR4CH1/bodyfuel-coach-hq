import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), process.argv[2] ?? ".build-profile.jsonl");

if (!fs.existsSync(file)) {
  console.error(`Build-Profil nicht gefunden: ${file}`);
  process.exit(1);
}

const events = fs
  .readFileSync(file, "utf8")
  .split("\n")
  .filter(Boolean)
  .flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });

if (events.length === 0) {
  console.error("Build-Profil enthält keine lesbaren Ereignisse.");
  process.exit(1);
}

const last = events.at(-1);
const heartbeats = events.filter((event) => event.type === "heartbeat");
const slowTransforms = events
  .filter((event) => event.type === "slow-transform")
  .sort((left, right) => right.elapsedMs - left.elapsedMs)
  .slice(0, 12);
const slowChunks = events
  .filter((event) => event.type === "slow-render-chunk")
  .sort((left, right) => right.elapsedMs - left.elapsedMs)
  .slice(0, 12);
const maxRss = Math.max(...events.map((event) => event.memory?.rssMb ?? 0));
const maxHeap = Math.max(...events.map((event) => event.memory?.heapUsedMb ?? 0));
const lastHeartbeat = heartbeats.at(-1);

console.log("\nBodyFuel Build-Profil");
console.log("======================");
console.log(`Ereignisse: ${events.length}`);
console.log(`Letzte Phase: ${last?.phase ?? "unbekannt"}`);
console.log(`Max. RSS: ${maxRss} MB`);
console.log(`Max. Heap: ${maxHeap} MB`);

if (lastHeartbeat?.transformedByEnvironment) {
  console.log("Transformierte Module:");
  for (const [environment, count] of Object.entries(lastHeartbeat.transformedByEnvironment)) {
    console.log(`  ${environment}: ${count}`);
  }
}

if (slowTransforms.length > 0) {
  console.log("\nLangsamste Transformationen:");
  for (const item of slowTransforms) {
    console.log(`  ${item.elapsedMs} ms  ${item.environment}  ${item.id}`);
  }
}

if (slowChunks.length > 0) {
  console.log("\nLangsamste Chunk-Renderings:");
  for (const item of slowChunks) {
    console.log(`  ${item.elapsedMs} ms  ${item.environment}  ${item.id}`);
  }
}

if (lastHeartbeat?.oldestTransforms?.length) {
  console.log("\nBeim letzten Heartbeat noch aktive Transformationen:");
  for (const item of lastHeartbeat.oldestTransforms.slice(0, 8)) {
    console.log(`  ${item.ageMs} ms  ${item.environment}  ${item.id}`);
  }
}

if (lastHeartbeat?.oldestChunks?.length) {
  console.log("\nBeim letzten Heartbeat noch aktive Chunks:");
  for (const item of lastHeartbeat.oldestChunks.slice(0, 8)) {
    console.log(`  ${item.ageMs} ms  ${item.environment}  ${item.id}`);
  }
}
