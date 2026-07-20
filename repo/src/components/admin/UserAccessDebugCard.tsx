import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { resolveUserAccessAsAdmin } from "@/lib/access/user-access.functions";

const WARNING_LABELS: Record<string, string> = {
  athlete_profile_orphaned: "Athletenprofil ohne User-Verknüpfung",
  org_membership_without_active_status: "Membership nicht aktiv",
  duplicate_membership: "Doppelte Membership",
  membership_without_profile: "Membership verweist auf unbekannten User",
  bodyfuel_customer_without_personal_context: "BodyFuel-Kunde ohne persönlichen Access",
  bulls_group_without_membership: "Bulls-Gruppe ohne aktive Bulls-Membership",
};

export function UserAccessDebugCard({ userId }: { userId: string }) {
  const fetchAccess = useServerFn(resolveUserAccessAsAdmin);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-user-access", userId],
    queryFn: () => fetchAccess({ data: { userId } }),
  });

  if (isLoading)
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Lade Zugriff & Rollen…
      </div>
    );
  if (error || !data)
    return (
      <div className="rounded-2xl border border-destructive/40 bg-card p-6 text-sm text-destructive">
        Zugriffsdaten konnten nicht geladen werden.
      </div>
    );

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Zugriff & Rollen</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Zentraler Access-Resolver (Source of Truth).
        </p>
      </div>

      {/* Auth */}
      <Section title="Auth User">
        <Row label="user_id" value={<code className="text-xs">{data.userId}</code>} />
        <Row label="Name" value={data.displayName ?? "—"} />
        <Row label="E-Mail" value={data.email ?? "—"} />
      </Section>

      {/* BodyFuel */}
      <Section title="BodyFuel (persönlich)">
        <Row label="Persönlicher Bereich" value={<Flag on={data.personalBodyfuelAccess} />} />
        <Row label="Smart" value={<Flag on={data.smartAccess} />} />
        <Row label="Coaching" value={<Flag on={data.coachingAccess} />} />
        <Row label="Free/Tracker" value={<Flag on={data.freeAccess} />} />
        <Row label="Plattform-Coach" value={<Flag on={data.isPlatformCoach} />} />
      </Section>

      {/* Organisationen */}
      <Section title={`Organisationen (${data.organizationMemberships.length})`}>
        {data.organizationMemberships.length === 0 ? (
          <div className="text-xs text-muted-foreground">Keine Mitgliedschaft.</div>
        ) : (
          data.organizationMemberships.map((m) => (
            <div
              key={m.organizationId}
              className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{m.organizationName}</div>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    m.membershipStatus === "active"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-amber-500/15 text-amber-500"
                  }`}
                >
                  {m.membershipStatus}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <div>slug: <span className="text-foreground">{m.organizationSlug}</span></div>
                <div>role: <span className="text-foreground">{m.role}</span></div>
                {m.staffRole && (
                  <div>staff: <span className="text-foreground">{m.staffRole}</span></div>
                )}
                <div>
                  team:{" "}
                  <span className="text-foreground">
                    {m.teamName ?? "—"}
                  </span>
                </div>
                <div className="col-span-2">
                  athlete_profile_linked:{" "}
                  <span className="text-foreground">
                    {m.athleteProfileLinked ? "ja" : "nein"}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* Verfügbare Kontexte */}
      <Section title={`Verfügbare Kontexte (${data.availableContexts.length})`}>
        <div className="flex flex-wrap gap-1.5">
          {data.availableContexts.length === 0 && (
            <span className="text-xs text-muted-foreground">Keine.</span>
          )}
          {data.availableContexts.map((c, i) => (
            <span
              key={i}
              className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold uppercase tracking-wider"
            >
              {c.type === "personal_bodyfuel" ? "🏠 " : "🏛 "}
              {c.label}
            </span>
          ))}
        </div>
      </Section>

      {/* Warnungen */}
      {data.warnings.length > 0 && (
        <Section title="Warnungen">
          <div className="space-y-1.5">
            {data.warnings.map((w) => (
              <div
                key={w}
                className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{WARNING_LABELS[w] ?? w}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
      {data.warnings.length === 0 && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Keine Warnungen — Zugriffe konsistent.
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-background/40 px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Flag({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-emerald-500">
      <CheckCircle2 className="h-3 w-3" /> ja
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Info className="h-3 w-3" /> nein
    </span>
  );
}
