import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Dumbbell, Target, Calendar, ChevronLeft } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { getOrgAthleticTraining, getOrgHomeData } from "@/lib/organizations/athlete.functions";
import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { PlanStatusChip } from "@/components/organizations/PlanStatusChip";
import { BullsAthleteAthleticSession } from "@/components/bodyfuel/BullsAthleteAthleticSession";
import { Route as OrgLayoutRoute } from "./$orgSlug";



export const Route = createFileRoute("/$orgSlug/training")({
  component: OrgTraining,
});

function OrgTraining() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const fetchTraining = useServerFn(getOrgAthleticTraining);
  const fetchHome = useServerFn(getOrgHomeData);

  useEffect(() => {
    if (!loading && !supabaseUser)
      navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
  }, [supabaseUser, loading, org.slug, navigate]);

  const { data } = useQuery({
    queryKey: ["org-training", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchTraining({ data: { slug: org.slug } }),
  });
  const { data: home } = useQuery({
    queryKey: ["org-home", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchHome({ data: { slug: org.slug } }),
  });

  if (!data || !home) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Laden…</div>;
  }

  const primary = org.primary_color ?? "#e11d48";
  // Phase 1b.1: Athletenkalender liest ausschließlich aus training_sessions.
  const today = ((data as any).today_sessions ?? []) as any[];
  const week = data.week as any[];
  const done = week.filter((w) => w.status === "done" || w.status === "completed").length;
  const plan = data.plan as any;
  const focusAreas: string[] = plan?.focus_areas ?? [];
  const position = data.team_membership?.position;

  return (
    <OrgAthleteLayout slug={org.slug} features={home.features as any} primaryColor={primary}>
      <header
        className="px-5 py-6 text-white"
        style={{ background: `linear-gradient(135deg, ${org.primary_color ?? "#000"} 0%, #000 100%)` }}
      >
        <Link
          to="/$orgSlug/home"
          params={{ orgSlug: org.slug }}
          className="mb-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80"
        >
          <ChevronLeft className="h-3 w-3" /> Home
        </Link>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{org.name}</div>
        <h1 className="font-display text-2xl font-bold">Athletiktraining</h1>
        <p className="mt-1 text-xs opacity-80">
          Getrennt von deinem persönlichen BODYFUEL-Trainingsplan.
        </p>
      </header>

      <main className="mx-auto max-w-md px-4 py-5 space-y-6">
        <PlanStatusChip userId={supabaseUser?.id} />
        <section>
          <Title>Heute</Title>

          {today.length === 0 ? (
            <Empty>Keine Athletik-Einheit für heute geplant.</Empty>
          ) : (
            <ul className="space-y-2">
              {today.map((t) => (
                <li key={t.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t.task_type === "athletic_training" ? "Athletik" : "Teamtraining"}
                  </div>
                  <div className="text-sm font-semibold">{t.title}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <Title>Dein Plan</Title>
          {plan ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4" style={{ color: primary }} />
                <div className="text-sm font-semibold">{plan.name}</div>
              </div>
              {plan.week_start && (
                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Woche ab {new Date(plan.week_start).toLocaleDateString("de-DE")}
                </div>
              )}
            </div>
          ) : (
            <Empty>Aktuell kein aktiver Bulls Athletic Development Plan.</Empty>
          )}
        </section>

        <section>
          <Title>Diese Woche</Title>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" style={{ color: primary }} />
              <span className="text-sm">
                <strong>{done}</strong> von <strong>{week.length}</strong> Einheiten abgeschlossen
              </span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Position
            </div>
            <div className="mt-1 font-display text-lg font-bold">{position ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Fokus
            </div>
            <div className="mt-1 space-y-0.5 text-xs">
              {focusAreas.length > 0 ? (
                focusAreas.slice(0, 3).map((f) => (
                  <div key={f} className="flex items-center gap-1">
                    <Target className="h-3 w-3" style={{ color: primary }} />
                    {f}
                  </div>
                ))
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </section>
      </main>
    </OrgAthleteLayout>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{children}</h2>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}
