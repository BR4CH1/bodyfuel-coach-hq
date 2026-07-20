import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compatibility entry point for old Bulls links and saved PWA shortcuts.
 * The generic organization route is the canonical Bulls hub.
 */
export const Route = createFileRoute("/bulls/")({
  beforeLoad: () => {
    throw redirect({
      to: "/$orgSlug",
      params: { orgSlug: "bulls" },
      replace: true,
    });
  },
});
