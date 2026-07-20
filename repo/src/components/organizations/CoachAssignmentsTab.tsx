// Phase 4 — Coach ↔ Kunden-Zuweisungen im Org-Cockpit.
//
// Zeigt bestehende Zuweisungen aus `organization_coach_assignments` und
// erlaubt das Anlegen/Entfernen. Nur für Owner/Admin editierbar.

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listOrgCoachAssignments,
  upsertOrgCoachAssignment,
  removeOrgCoachAssignment,
  listOrgCoachesAndCustomers,
  type OrgCoachAssignmentRow,
} from "@/lib/organizations/organizations.functions";
import { Trash2, UserPlus } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  primary_coach: "Hauptcoach",
  secondary_coach: "Zweitcoach",
  nutrition_coach: "Ernährungscoach",
  training_coach: "Trainingscoach",
  substitute: "Vertretung",
};

export function CoachAssignmentsTab({
  orgId,
  canManage,
  terminology,
}: {
  orgId: string;
  canManage: boolean;
  terminology: { coach: string; coaches: string; player: string; players: string };
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listOrgCoachAssignments);
  const rosterFn = useServerFn(listOrgCoachesAndCustomers);
  const upsertFn = useServerFn(upsertOrgCoachAssignment);
  const removeFn = useServerFn(removeOrgCoachAssignment);

  const { data: assignments = [], isLoading: loadingA } = useQuery({
    queryKey: ["org-coach-assignments", orgId],
    queryFn: () => listFn({ data: { orgId } }),
  });
  const { data: roster, isLoading: loadingR } = useQuery({
    queryKey: ["org-roster", orgId],
    queryFn: () => rosterFn({ data: { orgId } }),
  });

  const [coachId, setCoachId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [role, setRole] = useState<string>("primary_coach");

  const add = useMutation({
    mutationFn: () =>
      upsertFn({
        data: { orgId, coachUserId: coachId, customerUserId: customerId, role },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-coach-assignments", orgId] });
      setCoachId("");
      setCustomerId("");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { orgId, assignmentId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-coach-assignments", orgId] }),
  });

  const grouped = useMemo(() => {
    const byCoach = new Map<string, OrgCoachAssignmentRow[]>();
    for (const a of assignments as OrgCoachAssignmentRow[]) {
      const key = a.coach_user_id;
      if (!byCoach.has(key)) byCoach.set(key, []);
      byCoach.get(key)!.push(a);
    }
    return byCoach;
  }, [assignments]);

  const coaches = roster?.coaches ?? [];
  const customers = roster?.customers ?? [];

  if (loadingA || loadingR) {
    return <div className="text-sm text-muted-foreground">Lädt…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold">{terminology.coaches} & {terminology.players}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Weise {terminology.players.toLowerCase()} einem {terminology.coach.toLowerCase()} zu. Ein/e {terminology.player.toLowerCase()} kann
          mehrere {terminology.coaches.toLowerCase()} in unterschiedlichen Rollen haben.
        </p>

        {canManage && (
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <select
              value={coachId}
              onChange={(e) => setCoachId(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">{terminology.coach} wählen…</option>
              {coaches.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.display_name ?? c.email ?? c.user_id.slice(0, 8)}
                </option>
              ))}
            </select>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">{terminology.player} wählen…</option>
              {customers.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.display_name ?? c.email ?? c.user_id.slice(0, 8)}
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!coachId || !customerId || add.isPending}
              onClick={() => add.mutate()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Zuweisen
            </button>
          </div>
        )}

        {add.isError && (
          <div className="mt-2 text-[11px] text-red-400">
            {(add.error as Error)?.message ?? "Fehler beim Zuweisen"}
          </div>
        )}

        <div className="mt-5 space-y-3">
          {coaches.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Noch keine {terminology.coaches.toLowerCase()} in dieser Organisation.
            </div>
          ) : (
            coaches.map((c) => {
              const rows = grouped.get(c.user_id) ?? [];
              return (
                <div key={c.user_id} className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold">
                        {c.display_name ?? c.email ?? c.user_id.slice(0, 8)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {c.role === "organization_admin" ? "Vereinsleitung / Admin" : terminology.coach}
                        {" · "}
                        {rows.length} {rows.length === 1 ? terminology.player : terminology.players}
                      </div>
                    </div>
                  </div>
                  {rows.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {rows.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span>{r.customer_name ?? r.customer_user_id.slice(0, 8)}</span>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                              {ROLE_LABELS[r.role] ?? r.role}
                            </span>
                          </div>
                          {canManage && (
                            <button
                              type="button"
                              disabled={remove.isPending}
                              onClick={() => remove.mutate(r.id)}
                              className="text-muted-foreground hover:text-red-400"
                              aria-label="Zuweisung entfernen"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
