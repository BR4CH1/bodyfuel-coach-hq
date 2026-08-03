// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";
import type { PluginOption, UserConfig } from "vite";
import { createBuildProfilePlugins } from "./scripts/vite-build-profile-plugin";

const buildProfileEnabled = process.env.BF_BUILD_PROFILE === "1";
const mcpEnabled = process.env.BF_DISABLE_MCP !== "1";
const pwaEnabled = process.env.BF_DISABLE_PWA !== "1";
const inlineSsr = process.env.BF_SSR_INLINE_DYNAMIC_IMPORTS === "1";

const plugins: PluginOption[] = [];

if (buildProfileEnabled) plugins.push(...createBuildProfilePlugins());
if (mcpEnabled) plugins.push(mcpPlugin());
if (pwaEnabled) {
  plugins.push(
    VitePWA({
      // Deployments must replace old route/auth code immediately. A waiting
      // worker previously kept the consumed invitation page alive on mobile.
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      outDir: ".output/public",
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
        navigateFallback: undefined,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" &&
              ["/welcome", "/auth", "/login", "/app", "/reset-password"].includes(url.pathname),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" &&
              !["/welcome", "/auth", "/login", "/app", "/reset-password"].includes(url.pathname) &&
              !url.pathname.startsWith("/api/") &&
              !url.pathname.startsWith("/~oauth") &&
              !url.pathname.startsWith("/lovable/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "bf-pages",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(?:js|css|woff2)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "bf-assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(?:png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "bf-images",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  );
}

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
