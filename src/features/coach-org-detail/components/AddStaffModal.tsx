import { useState } from "react";
import {
  PRESET_LABELS,
  permissionLabel,
  type PermissionKey,
  type PresetKey,
} from "@/lib/organizations/staff-labels";
import {
  getMissingPermissions,
  getStaffPreset,
  normalizeStaffEmail,
  togglePermission,
} from "../lib/staff.logic";
import type { AddOrgStaffPayload, OrgTeam } from "../types";
import { PermissionChecklist } from "./PermissionChecklist";

type AddStaffModalProps = {
  teams: OrgTeam[];
  onClose: () => void;
  onSubmit: (payload: AddOrgStaffPayload) => Promise<void>;
};

const PRESET_KEYS = Object.keys(PRESET_LABELS) as PresetKey[];

export function AddStaffModal({ teams, onClose, onSubmit }: AddStaffModalProps) {
  const [email, setEmail] = useState("");
  const [presetKey, setPresetKey] = useState<PresetKey>("TEAM_COACH");
  const [permissions, setPermissions] = useState<PermissionKey[]>(
    () => getStaffPreset("TEAM_COACH").permissions,
  );
  const [teamId, setTeamId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preset = getStaffPreset(presetKey);
  const missingPermissions = getMissingPermissions(permissions);

  const applyPreset = (nextPresetKey: PresetKey) => {
    const nextPreset = getStaffPreset(nextPresetKey);
    setPresetKey(nextPresetKey);
    setPermissions(nextPreset.permissions);
  };

  const submit = async () => {
    const normalizedEmail = normalizeStaffEmail(email);
    if (!normalizedEmail) {
      setError("E-Mail erforderlich.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        email: normalizedEmail,
        role: preset.role,
        team_id: teamId,
        permissions,
      });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Fehler.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
      <div className="my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-lg border border-border bg-card text-sm">
        <div className="sticky top-0 flex items-center justify-between rounded-t-lg border-b border-border bg-card px-5 py-4">
          <h3 className="font-display text-lg font-bold">Trainer / Mitarbeiter hinzufügen</h3>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              E-Mail
            </label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@example.com"
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
              autoFocus
            />
            <div className="mt-1 text-[10px] text-muted-foreground">
              Existiert bereits ein BODYFUEL Account, wird er sofort zugeordnet – keine
              Account-Duplikation. Sonst wird ein Invite-Token erstellt.
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Funktion im Verein
            </label>
            <select
              value={presetKey}
              onChange={(event) => applyPreset(event.target.value as PresetKey)}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
            >
              {PRESET_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PRESET_LABELS[key].label}
                </option>
              ))}
            </select>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {PRESET_LABELS[presetKey].description}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Zuständigkeit{" "}
              {preset.scope_hint === "team" ? "(empfohlen: einzelnes Team)" : "(optional)"}
            </label>
            <select
              value={teamId ?? ""}
              onChange={(event) => setTeamId(event.target.value || null)}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Berechtigungen
            </label>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Die Funktion schlägt passende Berechtigungen vor. Du kannst sie individuell anpassen.
            </div>
            <div className="mt-2">
              <PermissionChecklist
                permissions={permissions}
                onToggle={(permission) =>
                  setPermissions((current) => togglePermission(current, permission))
                }
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Zusammenfassung
            </div>
            <div className="mt-1 text-sm font-semibold">{PRESET_LABELS[presetKey].label}</div>
            <div className="mt-2 text-[11px]">
              <span className="text-muted-foreground">Zuständigkeit: </span>
              {teamId
                ? `Team: ${teams.find((team) => team.id === teamId)?.name ?? "—"}`
                : "Gesamter Verein"}
            </div>
            <div className="mt-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Zugriff
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px]">
                {permissions.length === 0 ? (
                  <li className="text-muted-foreground">Keine Berechtigungen ausgewählt.</li>
                ) : (
                  permissions.map((permission) => (
                    <li key={permission}>✓ {permissionLabel(permission)}</li>
                  ))
                )}
              </ul>
            </div>
            {missingPermissions.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Kein Zugriff
                </div>
                <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  {missingPermissions.map((permission) => (
                    <li key={permission}>– {permissionLabel(permission)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-2 text-[10px] text-muted-foreground">
              Berechtigungen bleiben individuell anpassbar.
            </div>
          </div>

          {error && <div className="text-xs text-red-500">{error}</div>}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 rounded-b-lg border-t border-border bg-card px-5 py-3">
          <button onClick={onClose} className="rounded border border-border px-3 py-1 text-xs">
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded bg-primary px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Speichert…" : "Hinzufügen"}
          </button>
        </div>
      </div>
    </div>
  );
}
