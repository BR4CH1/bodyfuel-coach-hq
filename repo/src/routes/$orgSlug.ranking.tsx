import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$orgSlug/ranking")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$orgSlug/community",
      params: { orgSlug: params.orgSlug },
      search: { tab: "ranking" },
      replace: true,
    });
  },
});
