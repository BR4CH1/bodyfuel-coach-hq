/* BodyFuel static service worker.
 *
 * This file intentionally lives in /public so the production host publishes
 * /sw.js directly. Do not move it back to a post-build generated artifact:
 * the production deploy does not currently publish VitePWA's generated sw.js.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Workbox-generated service workers were previously used. Remove their
      // stale runtime/precache data when this static worker takes over.
      caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "BodyFuel Coach";
  const body = payload.body || "In BodyFuel gibt es ein neues Coaching-Ereignis.";
  const data = {
    url: typeof payload.url === "string" ? payload.url : "/coach",
  };

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: typeof payload.tag === "string" ? payload.tag : undefined,
      renotify: false,
      data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification?.data?.url || "/coach",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if (client.url === targetUrl && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        return undefined;
      }),
  );
});
