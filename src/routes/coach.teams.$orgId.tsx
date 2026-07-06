import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { listOrganizationsForStaff } from "@/lib/organizations/organizations.functions";

export const Route = createFileRoute("/coach/teams/$orgId")({
  head: () => ({ meta: [{ title: "Team-Verwaltung — BODYFUEL Coach" }] }),
  component: () => (
    <AppLayout>
      <CoachOrg />
    </AppLayout>
  ),
});

function CoachOrg() {
  const { orgId } = Route.useParams();
  const fetchOrgs = useServerFn(listOrganizationsForStaff);
  const { data: orgs } = useQuery({
    queryKey: ["coach-orgs"],
    queryFn: () => fetchOrgs(),
  });
  const org = (orgs ?? []).find((o) => o.id === orgId);

  const { data: teams } = useQuery({
    queryKey: ["org-teams", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_teams")
        .select("id, name, slug, sport, age_group, status")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_memberships")
        .select("id, user_id, role, status, onboarding_completed")
        .eq("organization_id", orgId);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: features } = useQuery({
    queryKey: ["org-features", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_features")
        .select("feature, enabled")
        .eq("organization_id", orgId);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (!org) {
    return <div className="text-sm text-muted-foreground">Organisation lädt…</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link to="/coach/teams" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
          ← Teams
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {org.logo_url ? (
          <img src={org.logo_url} alt={org.name} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div
            className="grid h-14 w-14 place-items-center rounded-full text-white"
            style={{ background: org.primary_color ?? "#333" }}
          >
            {org.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold">{org.name}</h1>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {org.organization_type}
          </div>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <StatCard label="Mitglieder" value={(members ?? []).length} />
        <StatCard label="Teams" value={(teams ?? []).length} />
        <StatCard
          label="Aktive Module"
          value={(features ?? []).filter((f) => f.enabled).length}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Teams</h2>
        {(teams ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Noch keine Teams angelegt.
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(teams ?? []).map((t) => (
              <li key={t.id} className="rounded-lg border border-border bg-card p-4">
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t.sport ?? "—"} {t.age_group ? `· ${t.age_group}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Module</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(features ?? []).map((f) => (
            <li
              key={f.feature}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm"
            >
              <span className="capitalize">{f.feature.replace(/_/g, " ")}</span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                  f.enabled ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
                }`}
              >
                {f.enabled ? "aktiv" : "aus"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Mitglieder</h2>
        {(members ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Noch keine Mitglieder.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Rolle</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Onboarding</th>
                </tr>
              </thead>
              <tbody>
                {(members ?? []).map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{m.user_id.slice(0, 8)}…</td>
                    <td className="px-3 py-2">{m.role}</td>
                    <td className="px-3 py-2">{m.status}</td>
                    <td className="px-3 py-2">{m.onboarding_completed ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
