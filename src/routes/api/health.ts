import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            ok: true,
            service: "bodyfuel-web",
            checkedAt: new Date().toISOString(),
          },
          {
            headers: {
              "cache-control": "no-store, max-age=0",
              "x-content-type-options": "nosniff",
            },
          },
        ),
    },
  },
});
