import { useEffect, useMemo, useState } from "react";
import {
  permissionLabel,
  roleLabelFromDbRole,
  scopeLabel,
  type PermissionKey,
} from "@/lib/organizations/staff-labels";
import { normalizePermissionList, togglePermission } from "../lib/staff.logic";
import type { OrgStaffMember, OrgStaffUpdatePatch, OrgTeam } from "../types";
import { PermissionChecklist } from "./PermissionChecklist";

type StaffRowProps = {
  row: OrgStaffMember;
  teams: OrgTeam[];
  onSave: (patch: OrgStaffUpdatePatch) => Promise<void>;
  onRemove: (deleteAccount: boolean) => void;
};

export function StaffRow({ row, teams, onSave, onRemove }: StaffRowProps) {
  const [edit, setEdit] = useState(false);
  const [permissions, setPermissions] = useState<PermissionKey[]>(() =>
    normalizePermissionList(row.permissions),
  );
  const [teamId, setTeamId] = useState<string | null>(row.team_id);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [deleteAccount, setDeleteAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const permissionsKey = useMemo(() => row.permissions.join("|"), [row.permissions]);

  useEffect(() => {
    if (edit) return;
    setPermissions(normalizePermissionList(row.permissions));
    setTeamId(row.team_id);
  }, [edit, permissionsKey, row.team_id, row.permissions]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ permissions, team_id: teamId });
      setEdit(false);
    } catch {
      // Global feedback is rendered by StaffTab; keep the editor open on failure.
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{row.name}</div>
          <div className="text-[11px] text-muted-foreground">{roleLabelFromDbRole(row.role)}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Zuständigkeit: {scopeLabel(row.team_name)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Berechtigungen: {row.permissions.length} Bereiche freigegeben
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setEdit((current) => !current)}
            className="text-[10px] uppercase tracking-wider text-primary"
          >
            {edit ? "Schließen" : "Berechtigungen ansehen"}
          </button>
          <button
            onClick={() => {
              setDeleteAccount(false);
              setRemoveOpen(true);
            }}
            className="text-[10px] uppercase tracking-wider text-red-500"
          >
            Entfernen
          </button>
        </div>
      </div>

      {removeOpen && (
        <div className="mt-3 rounded border border-red-500/40 bg-red-500/5 p-3 text-xs">
          <div className="font-semibold text-red-500">{row.name} entfernen?</div>
          <label className="mt-2 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={deleteAccount}
              onChange={(event) => setDeleteAccount(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">BODYFUEL-Konto komplett löschen</span>
              <span className="block text-[10px] text-muted-foreground">
                Auth-Zugang, Profil und alle Zugehörigkeiten werden endgültig entfernt. Ohne Haken
                bleibt der Account bestehen und wird nur aus diesem Verein entfernt.
              </span>
            </span>
          </label>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setRemoveOpen(false)}
              className="rounded border border-border bg-background px-3 py-1 text-[10px] uppercase tracking-wider"
            >
              Abbrechen
            </button>
            <button
              onClick={() => {
                setRemoveOpen(false);
                onRemove(deleteAccount);
              }}
              className="rounded bg-red-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
            >
              {deleteAccount ? "Endgültig löschen" : "Aus Verein entfernen"}
            </button>
          </div>
        </div>
      )}

      {!edit && row.permissions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {row.permissions.map((permission) => (
            <span key={permission} className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium">
              {permissionLabel(permission)}
            </span>
          ))}
        </div>
      )}

      {edit && (
        <div className="mt-3 space-y-4 border-t border-border pt-3">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Zuständigkeit
            </div>
            <select
              value={teamId ?? ""}
              onChange={(event) => setTeamId(event.target.value || null)}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="">Gesamter Verein</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  Team: {team.name}
                </option>
              ))}
            </select>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Die Zuständigkeit legt fest, für welche Teams diese Person Zugriff erhält.
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Berechtigungen
            </div>
            <PermissionChecklist
              permissions={permissions}
              onToggle={(permission) =>
                setPermissions((current) => togglePermission(current, permission))
              }
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </div>
      )}
    </li>
  );
}
