// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import type { PluginOption, UserConfig } from "vite";
import { createBuildProfilePlugins } from "./scripts/vite-build-profile-plugin";

const buildProfileEnabled = process.env.BF_BUILD_PROFILE === "1";
const mcpEnabled = process.env.BF_DISABLE_MCP !== "1";
const inlineSsr = process.env.BF_SSR_INLINE_DYNAMIC_IMPORTS === "1";

const plugins: PluginOption[] = [];

if (buildProfileEnabled) plugins.push(...createBuildProfilePlugins());
if (mcpEnabled) plugins.push(mcpPlugin());

const viteConfig: UserConfig = { plugins };

if (inlineSsr) {
  viteConfig.environments = {
    ssr: {
      build: {
        rollupOptions: {
          output: { inlineDynamicImports: true },
        },
      },
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: viteConfig,
});
