// Phase 6 — Erweitertes Branding im Org-Cockpit.
//
// Editiert Farben, Logos, App-Name (short_name), Claim/Welcome-Text und
// beliebige zusätzliche Felder in `branding_extra` (jsonb). Für Bulls hart
// gesperrt (siehe Server-Fn).

import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrganizationBranding } from "@/lib/organizations/organizations.functions";

type OrgBranding = {
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  text_color: string | null;
  logo_url: string | null;
  alt_logo_url: string | null;
  claim: string | null;
  short_name: string | null;
  branding_mode: string | null;
  branding_extra: Record<string, unknown> | null;
};

type ExtraKeys = "login_image_url" | "dashboard_image_url" | "welcome_text" | "app_name";

const EXTRA_FIELDS: { key: ExtraKeys; label: string; hint: string; textarea?: boolean }[] = [
  { key: "app_name", label: "App-Name", hint: "Wird im Header und in E-Mails verwendet." },
  { key: "welcome_text", label: "Begrüßungstext", hint: "Wird im Athleten-Home angezeigt.", textarea: true },
  { key: "login_image_url", label: "Login-Bild (URL)", hint: "Bild auf der Login-Seite dieser Organisation." },
  { key: "dashboard_image_url", label: "Dashboard-Bild (URL)", hint: "Optionales Hero-Bild im Athleten-Dashboard." },
];

const MODE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "bodyfuel", label: "BodyFuel Branding", description: "Standard-Branding von BodyFuel Performance." },
  { value: "powered_by", label: "Powered by BodyFuel", description: "Eigene Farben und Logo, dezenter BodyFuel-Hinweis." },
  { value: "white_label", label: "White-Label", description: "Vollständig eigenes Branding, kein BodyFuel-Hinweis." },
];

export function OrgBrandingTab({
  orgId,
  org,
  canManage,
}: {
  orgId: string;
  org: Partial<OrgBranding>;
  canManage: boolean;
}) {
  const [values, setValues] = useState<Partial<OrgBranding>>(() => ({
    primary_color: org.primary_color ?? null,
    secondary_color: org.secondary_color ?? null,
    accent_color: org.accent_color ?? null,
    background_color: org.background_color ?? null,
    text_color: org.text_color ?? null,
    logo_url: org.logo_url ?? null,
    alt_logo_url: org.alt_logo_url ?? null,
    claim: org.claim ?? null,
    short_name: org.short_name ?? null,
    branding_mode: org.branding_mode ?? "bodyfuel",
    branding_extra: (org.branding_extra ?? {}) as Record<string, unknown>,
  }));

  useEffect(() => {
    setValues({
      primary_color: org.primary_color ?? null,
      secondary_color: org.secondary_color ?? null,
      accent_color: org.accent_color ?? null,
      background_color: org.background_color ?? null,
      text_color: org.text_color ?? null,
      logo_url: org.logo_url ?? null,
      alt_logo_url: org.alt_logo_url ?? null,
      claim: org.claim ?? null,
      short_name: org.short_name ?? null,
      branding_mode: org.branding_mode ?? "bodyfuel",
      branding_extra: (org.branding_extra ?? {}) as Record<string, unknown>,
    });
  }, [org]);

  const qc = useQueryClient();
  const saveFn = useServerFn(updateOrganizationBranding);
  const mut = useMutation({
    mutationFn: () => saveFn({ data: { orgId, ...(values as any) } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-org-detail", orgId] }),
  });

  const setColor = (k: keyof OrgBranding) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [k]: e.target.value || null }));
  const setText = (k: keyof OrgBranding) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [k]: e.target.value || null }));
  const setExtra = (k: ExtraKeys) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((prev) => ({
      ...prev,
      branding_extra: { ...(prev.branding_extra ?? {}), [k]: e.target.value || null },
    }));

  const extra = (values.branding_extra ?? {}) as Record<string, unknown>;

  const ColorInput = ({ k, label }: { k: keyof OrgBranding; label: string }) => (
    <label className="block">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          disabled={!canManage || mut.isPending}
          value={(values[k] as string) ?? "#000000"}
          onChange={setColor(k)}
          className="h-9 w-12 shrink-0 rounded border border-border bg-background"
        />
        <input
          type="text"
          disabled={!canManage || mut.isPending}
          value={(values[k] as string) ?? ""}
          placeholder="#RRGGBB"
          onChange={setColor(k)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold">Branding</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Farben, Logos und Texte dieser Organisation. Wirkt auf Athleten- und Coach-UI.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ColorInput k="primary_color" label="Primärfarbe" />
          <ColorInput k="secondary_color" label="Sekundärfarbe" />
          <ColorInput k="accent_color" label="Akzentfarbe" />
          <ColorInput k="background_color" label="Hintergrund" />
          <ColorInput k="text_color" label="Textfarbe" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Logo-URL</div>
            <input
              type="text"
              disabled={!canManage || mut.isPending}
              value={values.logo_url ?? ""}
              onChange={setText("logo_url")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="https://…"
            />
          </label>
          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Alt-Logo-URL (Dark)</div>
            <input
              type="text"
              disabled={!canManage || mut.isPending}
              value={values.alt_logo_url ?? ""}
              onChange={setText("alt_logo_url")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="https://…"
            />
          </label>
          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Kurzname</div>
            <input
              type="text"
              disabled={!canManage || mut.isPending}
              value={values.short_name ?? ""}
              onChange={setText("short_name")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="z. B. Bulls"
            />
          </label>
          <label className="block">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Claim</div>
            <input
              type="text"
              disabled={!canManage || mut.isPending}
              value={values.claim ?? ""}
              onChange={setText("claim")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Fuel your performance"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Branding-Modus</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {MODE_OPTIONS.map((opt) => {
              const on = (values.branding_mode ?? "bodyfuel") === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!canManage || mut.isPending}
                  onClick={() => setValues((prev) => ({ ...prev, branding_mode: opt.value }))}
                  className={`rounded-xl border p-3 text-left transition ${
                    on
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/40 hover:border-primary/50"
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{opt.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {EXTRA_FIELDS.map((f) =>
            f.textarea ? (
              <label key={f.key} className="block sm:col-span-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{f.label}</div>
                <textarea
                  disabled={!canManage || mut.isPending}
                  value={String(extra[f.key] ?? "")}
                  onChange={setExtra(f.key)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder={f.hint}
                />
                <div className="mt-0.5 text-[10px] text-muted-foreground">{f.hint}</div>
              </label>
            ) : (
              <label key={f.key} className="block">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{f.label}</div>
                <input
                  type="text"
                  disabled={!canManage || mut.isPending}
                  value={String(extra[f.key] ?? "")}
                  onChange={setExtra(f.key)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder={f.hint}
                />
              </label>
            ),
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {mut.isError && (
            <span className="text-[11px] text-red-400">
              {(mut.error as Error)?.message ?? "Fehler"}
            </span>
          )}
          {mut.isSuccess && <span className="text-[11px] text-emerald-400">Gespeichert.</span>}
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
    </div>
  );
}
