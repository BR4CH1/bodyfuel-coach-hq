import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { listMyCourseInstructorOrgs } from "@/lib/course-instructor.functions";
import { getOrganizationContext } from "@/lib/organizations/organizations.functions";
import { getActiveContext } from "@/components/organizations/OrganizationContextSwitcher";

export const Route = createFileRoute("/coach-tools")({
  head: () => ({ meta: [{ title: "Coach Tools — BODYFUEL" }] }),
  component: CoachToolsLayout,
});

function CoachToolsLayout() {
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const activeOrgContext = getActiveContext();
  const listCourseInstructorOrgsFn = useServerFn(listMyCourseInstructorOrgs);
  const getOrgContextFn = useServerFn(getOrganizationContext);

  const { data: allowed, isLoading: gateLoading } = useQuery({
    queryKey: ["coach-tools-route-allowed", supabaseUser?.id ?? "anon", activeOrgContext],
    enabled: !!supabaseUser?.id,
    staleTime: 60_000,
    queryFn: async () => {
      if (!activeOrgContext) return false;
      const result = await listCourseInstructorOrgsFn();
      return (result.orgSlugs ?? []).includes(activeOrgContext);
    },
  });

  const { data: orgCtx, isLoading: ctxLoading } = useQuery({
    queryKey: ["coach-tools-org-ctx", supabaseUser?.id ?? "anon", activeOrgContext],
    enabled: !!supabaseUser?.id && !!activeOrgContext && allowed === true,
    staleTime: 60_000,
    queryFn: () => getOrgContextFn({ data: { slug: activeOrgContext! } }),
  });

  useEffect(() => {
    if (!loading && !gateLoading && supabaseUser && allowed === false) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, gateLoading, supabaseUser, allowed, navigate]);

  if (loading || gateLoading || !supabaseUser || !allowed) return null;

  if (activeOrgContext && orgCtx) {
    return (
      <OrgAthleteLayout
        slug={orgCtx.organization.slug}
        features={orgCtx.features}
        primaryColor={orgCtx.organization.primary_color}
        organizationType={orgCtx.organization.organization_type}
        terminologyOverrides={null}
      >
        <div className="mx-auto max-w-md px-4 pt-6">
          <Outlet />
        </div>
      </OrgAthleteLayout>
    );
  }

  if (activeOrgContext && ctxLoading) return null;

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
