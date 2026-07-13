import { Activity, AlertTriangle, ClipboardList, ListChecks, GraduationCap } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import { PulseCell, Section } from "./athlete-tab-shared";
import { RemoveFromTeamSection } from "./RemoveFromTeamSection";
import {
  getAthleteCourseInstructor,
  setAthleteCourseInstructor,
} from "@/lib/course-instructor.functions";

export function AthleteOverviewTab({
  data,
  orgId,
  userId,
}: {
  data: CoachAthleteDetail;
  orgId: string;
  userId: string;
}) {
  const p = data.pulse;
  const recent = data.training.timeline.slice(0, 5);
  return (
    <div className="space-y-5">
      <CourseInstructorToggle userId={userId} />
      <Section title="Aktueller Status" icon={<Activity className="h-4 w-4" />}>

        <div className="grid grid-cols-2 gap-2.5">
          <PulseCell
            label="Compliance"
            value={p.compliance != null ? `${p.compliance} %` : "—"}
            delta={p.compliance_delta}
            suffix=" Pp"
          />
          <PulseCell
            label="Trainingsaktivität"
            value={p.training_activity != null ? `${p.training_activity} %` : "—"}
            delta={p.training_activity_delta}
            suffix=" %"
          />
          <PulseCell
            label="Athletik"
            value={p.strength_score != null ? String(p.strength_score) : "—"}
            delta={p.strength_score_delta}
            suffix={
              p.strength_score_span_weeks != null
                ? ` Pkt / ${p.strength_score_span_weeks} Wo`
                : " Pkt"
            }
          />
          <PulseCell
            label="Letzte Aktivität"
            value={
              p.last_active_days == null
                ? "—"
                : p.last_active_days === 0
                ? "heute"
                : p.last_active_days === 1
                ? "gestern"
                : `vor ${p.last_active_days} Tagen`
            }
            delta={null}
            suffix=""
          />
        </div>
      </Section>

      <Section title="Coach Summary" icon={<ClipboardList className="h-4 w-4" />}>
        <div className="rounded-lg border border-border bg-card p-4">
          {data.summary.data_sparse ? (
            <p className="text-sm text-muted-foreground">
              Noch nicht genügend Daten für eine vollständige Analyse.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm leading-relaxed">
              {data.summary.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title="Coach Radar" icon={<AlertTriangle className="h-4 w-4" />}>
        {data.radar_triggers.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
            Aktuell keine ausgelösten Regeln. Der Athlet ist analytisch unauffällig.
          </div>
        ) : (
          <ul className="space-y-2">
            {data.radar_triggers.map((t, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
              >
                <span className="mt-0.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  {t.label}
                </span>
                <span className="text-sm">{t.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Letzte Aktivitäten" icon={<ListChecks className="h-4 w-4" />}>
        {recent.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
            Noch keine erfassten Aktivitäten.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {recent.map((item) => {
              const dateStr = new Date(item.date).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
              });
              const statusLabel =
                item.status === "done"
                  ? "Abgeschlossen"
                  : item.status === "missed"
                  ? "Ausgelassen"
                  : item.status === "open"
                  ? "Offen"
                  : "—";
              const statusCls =
                item.status === "done"
                  ? "text-green-500"
                  : item.status === "missed"
                  ? "text-red-500"
                  : "text-orange-400";
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {dateStr}
                    </div>
                    <div className="truncate text-sm font-semibold">{item.title}</div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${statusCls}`}>
                    {statusLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <RemoveFromTeamSection
        orgId={orgId}
        userId={userId}
        displayName={data.athlete.display_name}
      />
    </div>
  );
}


function CourseInstructorToggle({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getAthleteCourseInstructor);
  const setFn = useServerFn(setAthleteCourseInstructor);
  const { data, isLoading } = useQuery({
    queryKey: ["athlete-course-instructor", userId],
    queryFn: () => getFn({ data: { userId } }),
  });
  const enabled = !!data?.enabled;
  const mut = useMutation({
    mutationFn: (next: boolean) => setFn({ data: { userId, enabled: next } }),
    onSuccess: (res: any) => {
      qc.setQueryData(["athlete-course-instructor", userId], { enabled: !!res?.enabled });
      toast.success(res?.enabled ? "Kursleiter-Modul aktiviert." : "Kursleiter-Modul deaktiviert.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-gold" />
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Kursleiter Modul
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Schaltet die „Coach Tools" (Timer, Übungen, Live-Kurs, Musik …) für diesen Nutzer frei.
        </p>
      </div>
      <button
        type="button"
        disabled={isLoading || mut.isPending}
        onClick={() => mut.mutate(!enabled)}
        aria-pressed={enabled}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
          enabled ? "bg-gold" : "bg-muted"
        } disabled:opacity-50`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-background shadow transition ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
