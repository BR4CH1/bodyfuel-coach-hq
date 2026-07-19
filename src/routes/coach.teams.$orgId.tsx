import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CoachOrgDetailPage } from "@/features/coach-org-detail/components/CoachOrgDetailPage";

export const Route = createFileRoute("/coach/teams/$orgId")({
  head: () => ({ meta: [{ title: "Organisation — BODYFUEL Coach" }] }),
  component: () => <Outlet />,
});

export function CoachOrgDetail() {
  const { orgId } = Route.useParams();
  return <CoachOrgDetailPage orgId={orgId} />;
}
