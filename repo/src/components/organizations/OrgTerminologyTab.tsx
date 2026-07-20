// Phase 3 — Terminologie überschreiben pro Organisation.
//
// Jede Zeile in "organizations.terminology" (jsonb) überschreibt einen
// einzelnen Begriff aus DEFAULT_TERMINOLOGY_BY_ORG_TYPE. Leere Felder
// fallen automatisch auf den Typ-Standard zurück.

import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrganizationTerminology } from "@/lib/organizations/organizations.functions";
import { defaultTerminologyForType, type OrgTerminology } from "@/lib/organizations/org-type";

type StringKey = keyof Pick<
  OrgTerminology,
  | "player"
  | "players"
  | "athlete"
  | "athletes"
  | "team"
  | "teams"
  | "coach"
  | "coaches"
  | "organization"
  | "organizationShort"
>;

const FIELDS: { key: StringKey; label: string; hint: string }[] = [
  { key: "player", label: "Person (Einzahl)", hint: "z. B. Spieler, Kunde, Mitglied, Mitarbeiter" },
  { key: "players", label: "Personen (Mehrzahl)", hint: "z. B. Spieler, Kunden, Mitglieder" },
  { key: "athlete", label: "Athlet (Einzahl)", hint: "sportlich-technische Bezeichnung" },
  { key: "athletes", label: "Athleten (Mehrzahl)", hint: "sportlich-technische Bezeichnung" },
  { key: "team", label: "Gruppe (Einzahl)", hint: "Mannschaft, Gruppe, Abteilung" },
  { key: "teams", label: "Gruppen (Mehrzahl)", hint: "Mannschaften, Gruppen, Abteilungen" },
  { key: "coach", label: "Betreuer (Einzahl)", hint: "Coach, Trainer, Ansprechpartner" },
  { key: "coaches", label: "Betreuer (Mehrzahl)", hint: "Coaches, Trainer" },
  { key: "organization", label: "Organisation (Langform)", hint: "Verein, Studio, Unternehmen" },
  { key: "organizationShort", label: "Organisation (Kurzform)", hint: "Kurzer Anzeigename in der Nav" },
];

export function OrgTerminologyTab({
  orgId,
  orgType,
  currentTerminology,
  canManage,
}: {
  orgId: string;
  orgType: string | null | undefined;
  currentTerminology: Record<string, unknown> | null | undefined;
  canManage: boolean;
}) {
  const defaults = defaultTerminologyForType(orgType);
  const merged = { ...defaults, ...(currentTerminology as any) };
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of FIELDS) v[f.key] = String((currentTerminology as any)?.[f.key] ?? "");
    return v;
  });
  useEffect(() => {
    const v: Record<string, string> = {};
    for (const f of FIELDS) v[f.key] = String((currentTerminology as any)?.[f.key] ?? "");
    setValues(v);
  }, [currentTerminology]);

  const qc = useQueryClient();
  const saveFn = useServerFn(updateOrganizationTerminology);
  const mut = useMutation({
    mutationFn: () => {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v.trim()) clean[k] = v.trim();
      }
      return saveFn({ data: { orgId, terminology: clean } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-org-detail", orgId] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold">Bezeichnungen</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Passe an, wie deine Athleten, Betreuer und Gruppen in dieser Organisation
          angezeigt werden. Leere Felder verwenden den Standard für den Organisationstyp.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {f.label}
              </div>
              <input
                type="text"
                value={values[f.key] ?? ""}
                disabled={!canManage || mut.isPending}
                placeholder={(merged as any)[f.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <div className="mt-0.5 text-[10px] text-muted-foreground">{f.hint}</div>
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          {mut.isError && (
            <span className="text-[11px] text-red-400">
              {(mut.error as Error)?.message ?? "Fehler"}
            </span>
          )}
          {mut.isSuccess && (
            <span className="text-[11px] text-emerald-400">Gespeichert.</span>
          )}
          <button
            type="button"
            disabled={!canManage || mut.isPending}
            onClick={() => mut.mutate()}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {mut.isPending ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 text-xs text-muted-foreground">
        <div className="text-[11px] font-bold uppercase tracking-wider text-foreground">
          Standard für diesen Typ
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <div className="text-[10px] uppercase tracking-wider opacity-70">{f.label}</div>
              <div className="text-sm text-foreground">{(defaults as any)[f.key] ?? "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
