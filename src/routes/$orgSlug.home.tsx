import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Clock, Trophy, Activity, TrendingUp, Users } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import {
  getOrgHomeData,
  updateOrgTaskStatus,
} from "@/lib/organizations/athlete.functions";

import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { OrganizationContextSwitcher, setActiveContext } from "@/components/organizations/OrganizationContextSwitcher";
import { Route as OrgLayoutRoute } from "./$orgSlug";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/$orgSlug/home")({
  component: OrgHome,
});

const TASK_TYPE_LABEL: Record<string, string> = {
  team_training: "TEAMTRAINING",
  athletic_training: "ATHLETIK",
  daily_checkin: "DAILY CHECK-IN",
  recovery: "RECOVERY",
  challenge: "CHALLENGE",
  hydration: "HYDRATION",
};

function greet() {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  return "Guten Abend";
}

function OrgHome() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const fetchHome = useServerFn(getOrgHomeData);
  const updateTask = useServerFn(updateOrgTaskStatus);
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !supabaseUser)
      navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
    if (supabaseUser) setActiveContext(org.slug);
  }, [supabaseUser, loading, org.slug, navigate]);

  // Task Engine wird zentral aus dem Coach-Dashboard ausgelöst (Staff/Coach-Berechtigung erforderlich).



  const { data, isLoading, error } = useQuery({
    queryKey: ["org-home", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchHome({ data: { slug: org.slug } }),
  });

  const toggle = useMutation({
    mutationFn: (v: { taskId: string; status: "open" | "done" }) => updateTask({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-home", org.slug] }),
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  if (isLoading || !data) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Laden…</div>;
  }
  if (error) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <div className="text-sm text-destructive">Kein Zugriff auf diese Organisation.</div>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link to="/dashboard">Mein BODYFUEL</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Onboarding gate
  if (data.membership && !data.membership.onboarding_completed) {
    navigate({ to: "/$orgSlug/onboarding", params: { orgSlug: org.slug }, replace: true });
    return null;
  }

  const bg = org.primary_color ?? "#000000";
  const primary = org.primary_color ?? "#e11d48";
  const first = data.profile?.display_name ?? "Athlet";
  const featuresList = data.features as { feature: string; enabled: boolean }[];
  const featureEnabled = (k: string) => featuresList.some((f) => f.feature === k && f.enabled);

  return (
    <OrgAthleteLayout slug={org.slug} features={featuresList} primaryColor={primary}>
      <header
        className="px-5 py-6 text-white"
        style={{ background: `linear-gradient(135deg, ${bg} 0%, #000 100%)` }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-sm font-bold">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
                {org.name}
              </div>
              <div className="text-xs opacity-75">{greet()},</div>
              <div className="font-display text-xl font-bold">{first}</div>
            </div>
          </div>
          <OrganizationContextSwitcher compact />
        </div>
        {(data.team || data.team_membership?.position) && (
          <div className="flex gap-2 text-[11px] uppercase tracking-wider">
            {data.team && (
              <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">{data.team.name}</span>
            )}
            {data.team_membership?.position && (
              <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
                {data.team_membership.position}
              </span>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-md px-4 py-5 space-y-6">
        {/* HEUTE */}
        <section>
          <SectionTitle>Heute</SectionTitle>
          {data.today_tasks.length === 0 ? (
            <EmptyCard>Heute sind keine Aufgaben geplant.</EmptyCard>
          ) : (
            <ul className="space-y-2">
              {data.today_tasks.map((t: any) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onToggle={() =>
                    toggle.mutate({ taskId: t.id, status: t.status === "done" ? "open" : "done" })
                  }
                />
              ))}
            </ul>
          )}
        </section>

        {/* DEIN STATUS */}
        <section>
          <SectionTitle>Dein Status</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {featureEnabled("readiness") && (
              <StatusCard icon={Activity} label="Readiness" value="—" hint="bald verfügbar" primary={primary} />
            )}
            <StatusCard icon={TrendingUp} label="Performance" value="—" hint="Profile in Kürze" primary={primary} />
            <StatusCard
              icon={CheckCircle2}
              label="Weekly Compliance"
              value={data.weekly_compliance != null ? `${data.weekly_compliance}%` : "—"}
              primary={primary}
            />
            <StatusCard
              icon={Trophy}
              label="Team Rank"
              value={data.challenge_progress?.rank ? `#${data.challenge_progress.rank}` : "—"}
              primary={primary}
            />
          </div>
        </section>

        {/* NÄCHSTE AUFGABEN */}
        {data.next_tasks.length > 0 && (
          <section>
            <SectionTitle>Nächste Aufgaben</SectionTitle>
            <ul className="space-y-2">
              {data.next_tasks.slice(0, 4).map((t: any) => (
                <li key={t.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{t.title}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {new Date(t.scheduled_for).toLocaleDateString("de-DE", { weekday: "short" })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* AKTIVE CHALLENGE */}
        {featureEnabled("challenges") && data.active_challenge && (
          <section>
            <SectionTitle>Aktive Challenge</SectionTitle>
            <div
              className="rounded-lg border border-border p-4 text-white"
              style={{ background: primary }}
            >
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-80">Challenge</div>
              <div className="mt-1 font-display text-lg font-bold uppercase">
                {(data.active_challenge as any).name}
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-80">Punkte</div>
                  <div className="font-display text-2xl font-bold">
                    {data.challenge_progress?.points ?? 0}
                  </div>
                </div>
                {(data.active_challenge as any).ends_at && (
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider opacity-80">Bis</div>
                    <div className="text-sm font-semibold">
                      {new Date((data.active_challenge as any).ends_at).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </OrgAthleteLayout>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{children}</h2>;
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function TaskCard({ task, onToggle }: { task: any; onToggle: () => void }) {
  const done = task.status === "done";
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <button type="button" onClick={onToggle} className="shrink-0">
        {done ? (
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        ) : (
          <Circle className="h-6 w-6 text-muted-foreground" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {TASK_TYPE_LABEL[task.task_type] ?? task.task_type}
        </div>
        <div className={`text-sm font-semibold ${done ? "line-through opacity-60" : ""}`}>{task.title}</div>
        {task.subtitle && <div className="text-xs text-muted-foreground">{task.subtitle}</div>}
      </div>
      {task.duration_min && (
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3 w-3" />
          {task.duration_min} Min
        </div>
      )}
    </li>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  hint,
  primary,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  primary: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color: primary }} />
        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
