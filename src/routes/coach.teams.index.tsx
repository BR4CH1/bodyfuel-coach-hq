import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { listOrganizationsForStaff } from "@/lib/organizations/organizations.functions";

export const Route = createFileRoute("/coach/teams/")({
  head: () => ({ meta: [{ title: "Teams — BODYFUEL Coach" }] }),
  component: () => (
    <AppLayout>
      <CoachTeams />
    </AppLayout>
  ),
});

function CoachTeams() {
  const fetchOrgs = useServerFn(listOrganizationsForStaff);
  const { data, isLoading } = useQuery({
    queryKey: ["coach-orgs"],
    queryFn: () => fetchOrgs(),
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Teams</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Organisationen, für die du Zugriff hast.
      </p>

      {isLoading ? (
        <div className="mt-6 text-sm text-muted-foreground">Laden…</div>
      ) : (data ?? []).length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Noch keine Organisation zugeordnet.
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {(data ?? []).map((org) => (
            <li key={org.id}>
              <Link
                to="/coach/teams/$orgId"
                params={{ orgId: org.id }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:bg-secondary"
              >
                {org.logo_url ? (
                  <img
                    src={org.logo_url}
                    alt={org.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="grid h-12 w-12 place-items-center rounded-full text-white"
                    style={{ background: org.primary_color ?? "#333" }}
                  >
                    {org.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{org.name}</div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {org.organization_type}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
