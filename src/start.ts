import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const nativeAppBuild = import.meta.env.VITE_NATIVE_APP === "1";
const nativeServerOrigin = (
  import.meta.env.VITE_APP_SERVER_ORIGIN || "https://bodyfuel-coaching.com"
).replace(/\/+$/, "");

const nativeServerFnFetch: typeof fetch = (input, init) => {
  if (!nativeAppBuild || typeof window === "undefined") {
    return fetch(input, init);
  }

  const sourceUrl =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.toString()
        : String(input);
  const localUrl = new URL(sourceUrl, window.location.origin);
  const targetUrl = new URL(
    `${localUrl.pathname}${localUrl.search}${localUrl.hash}`,
    `${nativeServerOrigin}/`,
  );

  // TanStack currently calls the custom transport with URL + RequestInit. Keep
  // Request input support as a defensive fallback so future upgrades do not
  // silently lose method/headers/body information.
  if (input instanceof Request) {
    const method = input.method.toUpperCase();
    return fetch(targetUrl, {
      method: input.method,
      headers: input.headers,
      body: method === "GET" || method === "HEAD" ? undefined : input.body,
      cache: input.cache,
      credentials: input.credentials,
      integrity: input.integrity,
      keepalive: input.keepalive,
      mode: input.mode,
      redirect: input.redirect,
      referrer: input.referrer,
      referrerPolicy: input.referrerPolicy,
      signal: input.signal,
      ...init,
    });
  }

  return fetch(targetUrl, init);
};

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
  serverFns: {
    fetch: nativeServerFnFetch,
  },
}));
