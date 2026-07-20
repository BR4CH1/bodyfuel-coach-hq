import { useState } from "react";
import { roleLabelFromDbRole } from "@/lib/organizations/staff-labels";
import { useOrgStaff } from "../hooks/useOrgStaff";
import type { OrgTeam } from "../types";
import { AddStaffModal } from "./AddStaffModal";
import { Card, Empty } from "./OrgDetailPrimitives";
import { StaffRow } from "./StaffRow";

type StaffTabProps = {
  orgId: string;
  teams: OrgTeam[];
};

export function StaffTab({ orgId, teams }: StaffTabProps) {
  const [showAdd, setShowAdd] = useState(false);
  const {
    staff,
    invites,
    isLoading,
    feedback,
    addStaffMember,
    updateStaffMember,
    removeStaffMember,
    revokeInvite,
    isRevoking,
  } = useOrgStaff(orgId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {staff.length} Trainer & Mitarbeiter · {invites.length} offene Einladungen
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
        >
          + Trainer / Mitarbeiter hinzufügen
        </button>
      </div>

      {feedback && (
        <div
          className={feedback.kind === "error" ? "text-xs text-red-500" : "text-xs text-green-500"}
        >
          {feedback.text}
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Lädt…</div>
      ) : staff.length === 0 ? (
        <Empty>Noch keine Trainer oder Mitarbeiter zugewiesen.</Empty>
      ) : (
        <ul className="space-y-2">
          {staff.map((member) => (
            <StaffRow
              key={member.id}
              row={member}
              teams={teams}
              onSave={(patch) => updateStaffMember(member.id, patch)}
              onRemove={(deleteAccount) => removeStaffMember(member.id, deleteAccount)}
            />
          ))}
        </ul>
      )}

      <Card title="Offene Einladungen">
        {invites.length === 0 ? (
          <Empty>Keine offenen Einladungen.</Empty>
        ) : (
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded border border-border bg-background p-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs">{invite.email}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {roleLabelFromDbRole(invite.assigned_role)} · läuft ab{" "}
                    {invite.expires_at
                      ? new Date(invite.expires_at).toLocaleDateString("de-DE")
                      : "—"}
                  </div>
                </div>
                <button
                  onClick={() => revokeInvite(invite.id)}
                  disabled={isRevoking}
                  className="shrink-0 text-[10px] uppercase tracking-wider text-red-500 disabled:opacity-50"
                >
                  Zurückziehen
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showAdd && (
        <AddStaffModal
          teams={teams}
          onClose={() => setShowAdd(false)}
          onSubmit={async (payload) => {
            await addStaffMember(payload);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}
