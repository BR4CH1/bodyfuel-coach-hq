import fs from "node:fs";
import path from "node:path";
import type { RenderedChunk } from "rollup";
import type { Plugin } from "vite";

type ActiveWork = {
  environment: string;
  id: string;
  startedAt: number;
};

type ProfileEvent = Record<string, unknown> & {
  type: string;
};

type ViteHookContext = {
  environment?: {
    name?: string;
  };
};

function environmentName(context: unknown): string {
  return (context as ViteHookContext | undefined)?.environment?.name ?? "unknown";
}

export function createBuildProfilePlugins(
  outputFile = process.env.BF_BUILD_PROFILE_FILE ?? ".build-profile.jsonl",
): Plugin[] {
  const outputPath = path.resolve(process.cwd(), outputFile);
  const activeTransforms = new Map<string, ActiveWork>();
  const activeChunks = new Map<string, ActiveWork>();
  const transformedByEnvironment = new Map<string, number>();
  const slowThresholdMs = Number(process.env.BF_BUILD_PROFILE_SLOW_MS ?? 1_000);
  let currentPhase = "initializing";
  let heartbeat: NodeJS.Timeout | undefined;
  let initialized = false;

  const write = (event: ProfileEvent) => {
    if (!initialized) {
      fs.writeFileSync(outputPath, "");
      initialized = true;
    }

    fs.appendFileSync(
      outputPath,
      `${JSON.stringify({
        at: new Date().toISOString(),
        pid: process.pid,
        phase: currentPhase,
        memory: {
          rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
        ...event,
      })}\n`,
    );
  };

  const oldest = (items: Map<string, ActiveWork>) => {
    const now = Date.now();
    return [...items.values()]
      .sort((left, right) => left.startedAt - right.startedAt)
      .slice(0, 15)
      .map((item) => ({
        environment: item.environment,
        id: item.id,
        ageMs: now - item.startedAt,
      }));
  };

  const ensureHeartbeat = () => {
    if (heartbeat) return;

    heartbeat = setInterval(() => {
      write({
        type: "heartbeat",
        activeTransforms: activeTransforms.size,
        activeChunks: activeChunks.size,
        transformedByEnvironment: Object.fromEntries(transformedByEnvironment),
        oldestTransforms: oldest(activeTransforms),
        oldestChunks: oldest(activeChunks),
      });
    }, 1_000);
    heartbeat.unref?.();
  };

  const stopHeartbeat = () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
  };

  const workKey = (environment: string, id: string) => `${environment}:${id}`;

  const pre: Plugin = {
    name: "bodyfuel-build-profile-pre",
    enforce: "pre",
    buildStart() {
      const environment = environmentName(this);
      currentPhase = `${environment}:transform`;
      ensureHeartbeat();
      write({ type: "build-start", environment });
    },
    transform(_code, id) {
      const environment = environmentName(this);
      activeTransforms.set(workKey(environment, id), {
        environment,
        id,
        startedAt: Date.now(),
      });
      transformedByEnvironment.set(
        environment,
        (transformedByEnvironment.get(environment) ?? 0) + 1,
      );
      return null;
    },
    buildEnd(error) {
      const environment = environmentName(this);
      currentPhase = `${environment}:build-end`;
      write({ type: "build-end-pre", environment, error: error ? String(error) : null });
    },
    renderStart() {
      const environment = environmentName(this);
      currentPhase = `${environment}:render`;
      write({ type: "render-start-pre", environment });
    },
    renderChunk(_code, chunk: RenderedChunk) {
      const environment = environmentName(this);
      activeChunks.set(workKey(environment, chunk.fileName), {
        environment,
        id: chunk.fileName,
        startedAt: Date.now(),
      });
      return null;
    },
    generateBundle() {
      const environment = environmentName(this);
      currentPhase = `${environment}:generate-bundle`;
      write({ type: "generate-bundle-pre", environment });
    },
    writeBundle() {
      const environment = environmentName(this);
      currentPhase = `${environment}:write-bundle`;
      write({ type: "write-bundle-pre", environment });
    },
  };

  const post: Plugin = {
    name: "bodyfuel-build-profile-post",
    enforce: "post",
    transform(_code, id) {
      const environment = environmentName(this);
      const key = workKey(environment, id);
      const started = activeTransforms.get(key);
      if (started) {
        const elapsedMs = Date.now() - started.startedAt;
        activeTransforms.delete(key);
        if (elapsedMs >= slowThresholdMs) {
          write({ type: "slow-transform", environment, id, elapsedMs });
        }
      }
      return null;
    },
    buildEnd(error) {
      const environment = environmentName(this);
      write({ type: "build-end-post", environment, error: error ? String(error) : null });
    },
    renderStart() {
      const environment = environmentName(this);
      write({ type: "render-start-post", environment });
    },
    renderChunk(_code, chunk: RenderedChunk) {
      const environment = environmentName(this);
      const key = workKey(environment, chunk.fileName);
      const started = activeChunks.get(key);
      if (started) {
        const elapsedMs = Date.now() - started.startedAt;
        activeChunks.delete(key);
        if (elapsedMs >= slowThresholdMs) {
          write({
            type: "slow-render-chunk",
            environment,
            id: chunk.fileName,
            elapsedMs,
          });
        }
      }
      return null;
    },
    generateBundle(_options, bundle) {
      const environment = environmentName(this);
      write({
        type: "generate-bundle-post",
        environment,
        files: Object.keys(bundle).length,
      });
    },
    writeBundle() {
      const environment = environmentName(this);
      write({ type: "write-bundle-post", environment });
    },
    closeBundle() {
      const environment = environmentName(this);
      currentPhase = `${environment}:complete`;
      write({
        type: "close-bundle",
        environment,
        activeTransforms: activeTransforms.size,
        activeChunks: activeChunks.size,
        transformedByEnvironment: Object.fromEntries(transformedByEnvironment),
      });
      stopHeartbeat();
    },
  };

  return [pre, post];
}
