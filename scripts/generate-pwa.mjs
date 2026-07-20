import { generateSW } from "workbox-build";

const { count, size, warnings } = await generateSW({
  globDirectory: ".output/public",
  globPatterns: [
    "**/*.{js,css,ico,png,jpg,jpeg,webp,svg,webmanifest,woff2}",
  ],
  globIgnores: [
    "sw.js",
    "workbox-*.js",
  ],
  swDest: ".output/public/sw.js",

  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  sourcemap: false,

  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "bf-pages",
        networkTimeoutSeconds: 4,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
    {
      urlPattern: ({ url, sameOrigin }) =>
        sameOrigin && /\.(?:js|css|woff2)$/.test(url.pathname),
      handler: "CacheFirst",
      options: {
        cacheName: "bf-assets",
        expiration: {
          maxEntries: 120,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: ({ url, sameOrigin }) =>
        sameOrigin &&
        /\.(?:png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname),
      handler: "CacheFirst",
      options: {
        cacheName: "bf-images",
        expiration: {
          maxEntries: 80,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
});

for (const warning of warnings) {
  console.warn(`[PWA-Warnung] ${warning}`);
}

console.log(
  `[PWA] Service Worker erzeugt: ${count} Dateien, ${Math.round(size / 1024)} KiB`,
);
