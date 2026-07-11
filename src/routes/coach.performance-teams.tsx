import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import {
  getIsPlatformOwner,
  listPerformanceTeams,
  createPerformanceTeamOrganization,
  type PerformanceTeamCard,
} from "@/lib/organizations/organizations.functions";
import { ORG_TYPE_OPTIONS, type OrgType } from "@/lib/organizations/org-type";
import {
  moduleSuggestions,
  defaultEnabledFeatureKeys,
  defaultLicenseForType,
  type ModulePresetState,
} from "@/lib/organizations/org-presets";
import { ORG_MODULE_BY_KEY, moduleFeatureKeys, type OrgModuleKey } from "@/lib/organizations/modules";
import { Switch } from "@/components/ui/switch";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Users, Shield, ExternalLink, Settings2 } from "lucide-react";

export const Route = createFileRoute("/coach/performance-teams")({
  head: () => ({ meta: [{ title: "Performance Teams — BODYFUEL Coach" }] }),
  component: () => (
    <AppLayout>
      <PerformanceTeamsPage />
    </AppLayout>
  ),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function PerformanceTeamsPage() {
  const navigate = useNavigate();
  const isOwnerFn = useServerFn(getIsPlatformOwner);
  const listFn = useServerFn(listPerformanceTeams);

  const { data: isOwner, isLoading: loadingRole } = useQuery({
    queryKey: ["is-platform-owner"],
    queryFn: () => isOwnerFn(),
  });

  const { data: teams, isLoading } = useQuery({
    queryKey: ["performance-teams"],
    queryFn: () => listFn(),
    enabled: !!isOwner,
  });

  const [creating, setCreating] = useState(false);

  if (loadingRole) {
    return <div className="text-sm text-muted-foreground">Prüfe Berechtigung…</div>;
  }
  if (!isOwner) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-semibold">Nur für Plattform-Owner</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Dieser Bereich ist ausschließlich für BODYFUEL-Plattform-Owner sichtbar.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Performance Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alle Vereine & Organisationen auf der BODYFUEL Performance-Plattform.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Neues Team erstellen
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 text-sm text-muted-foreground">Lade Teams…</div>
      ) : (teams ?? []).length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Noch keine Teams. Lege dein erstes Performance-Team an.
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(teams ?? []).map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              onManage={() =>
                navigate({ to: "/coach/teams/$orgId", params: { orgId: t.id } })
              }
            />
          ))}
        </ul>
      )}

      <CreateTeamDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(slug, id) => {
          setCreating(false);
          toast.success("Performance-Team erstellt.");
          navigate({ to: "/coach/teams/$orgId", params: { orgId: id } });
        }}
      />
    </div>
  );
}

function TeamCard({
  team,
  onManage,
}: {
  team: PerformanceTeamCard;
  onManage: () => void;
}) {
  const primary = team.primary_color ?? "#111";
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div
        className="flex items-center gap-3 p-4"
        style={{
          background: `linear-gradient(135deg, ${primary}22 0%, transparent 60%)`,
        }}
      >
        {team.logo_url ? (
          <img
            src={team.logo_url}
            alt={team.name}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div
            className="grid h-14 w-14 place-items-center rounded-full font-bold text-white"
            style={{ background: primary }}
          >
            {(team.short_name ?? team.name).slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{team.name}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {team.sport ?? team.organization_type ?? "—"}
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            team.status === "active"
              ? "bg-emerald-500/15 text-emerald-600"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {team.status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-border/50 p-4 text-center">
        <Stat label="Mannschaften" value={team.team_count} />
        <Stat label="Athleten" value={team.athlete_count} />
        <Stat label="Coaches" value={team.staff_count} />
      </div>
      <div className="mt-auto flex flex-wrap gap-2 border-t border-border/50 p-3">
        <Button size="sm" onClick={onManage} className="flex-1 gap-1">
          <Settings2 className="h-3.5 w-3.5" /> Verwalten
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/$orgSlug" params={{ orgSlug: team.slug }} target="_blank">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function CreateTeamDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (slug: string, id: string) => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createPerformanceTeamOrganization);
  type Step = 1 | 2 | 3 | 4;
  const [step, setStep] = useState<Step>(1);
  const initialForm = {
    name: "",
    short_name: "",
    slug: "",
    slugTouched: false,
    organization_type: "sports_club" as OrgType,
    sport: "Fußball",
    claim: "",
    logo_url: "",
    alt_logo_url: "",
    primary_color: "#111111",
    secondary_color: "#ffffff",
    accent_color: "#f59e0b",
    background_color: "#0f172a",
    text_color: "#ffffff",
  };
  const [form, setForm] = useState(initialForm);

  // Modul-Auswahl: Set aktivierter Modul-Keys (aus dem Katalog). Wird beim
  // Typ-Wechsel vom Preset neu gefüllt, solange der Nutzer sie nicht manuell
  // angefasst hat.
  const [modulesTouched, setModulesTouched] = useState(false);
  const [enabledModules, setEnabledModules] = useState<Set<OrgModuleKey>>(() => {
    const initial = new Set<OrgModuleKey>();
    for (const s of moduleSuggestions("sports_club")) {
      if (s.state === "on") initial.add(s.module.key);
    }
    return initial;
  });

  // Lizenz-Defaults: reagieren ebenfalls auf Typ-Wechsel, bleiben aber
  // editierbar.
  const [licenseTouched, setLicenseTouched] = useState(false);
  const [license, setLicense] = useState(() => defaultLicenseForType("sports_club"));

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Beim Typwechsel Preset/License neu vorbelegen (nur wenn nicht bereits
  // manuell angepasst).
  const onTypeChange = (t: OrgType) => {
    setField("organization_type", t);
    if (!modulesTouched) {
      const next = new Set<OrgModuleKey>();
      for (const s of moduleSuggestions(t)) {
        if (s.state === "on") next.add(s.module.key);
      }
      setEnabledModules(next);
    }
    if (!licenseTouched) {
      setLicense(defaultLicenseForType(t));
    }
  };

  const suggestions = useMemo(
    () => moduleSuggestions(form.organization_type),
    [form.organization_type],
  );

  const autoSlug = useMemo(
    () => (form.slugTouched ? form.slug : slugify(form.short_name || form.name)),
    [form.name, form.short_name, form.slug, form.slugTouched],
  );

  const toggleModule = (key: OrgModuleKey) => {
    setModulesTouched(true);
    setEnabledModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resetModulesToPreset = () => {
    setModulesTouched(false);
    const next = new Set<OrgModuleKey>();
    for (const s of moduleSuggestions(form.organization_type)) {
      if (s.state === "on") next.add(s.module.key);
    }
    setEnabledModules(next);
  };

  // Alle DB-Feature-Keys (inkl. Aliase) aus der Auswahl.
  const enabledFeatureKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const key of enabledModules) {
      const def = ORG_MODULE_BY_KEY[key];
      if (!def) continue;
      for (const f of moduleFeatureKeys(def)) keys.add(f);
    }
    // Home-Nav ist immer sinnvoll, damit die App überhaupt eine Startseite hat.
    keys.add("home");
    return Array.from(keys);
  }, [enabledModules]);

  const create = useMutation({
    mutationFn: (payload: Parameters<typeof createFn>[0]) => createFn(payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["performance-teams"] });
      onCreated(res.slug, res.id);
      // reset
      setStep(1);
      setForm(initialForm);
      setModulesTouched(false);
      setLicenseTouched(false);
      setLicense(defaultLicenseForType("sports_club"));
      const initial = new Set<OrgModuleKey>();
      for (const s of moduleSuggestions("sports_club")) {
        if (s.state === "on") initial.add(s.module.key);
      }
      setEnabledModules(initial);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erstellen fehlgeschlagen."),
  });

  const canNext1 = form.name.trim().length >= 2 && autoSlug.length >= 2;
  const canSubmit = canNext1 && !create.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neues Performance-Team</DialogTitle>
          <DialogDescription>
            Schritt {step} von 3 — das Team startet komplett leer, keine Bulls-Daten
            werden übernommen.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-3">
            <Field label="Organisationstyp *">
              <div className="grid gap-2 sm:grid-cols-2">
                {ORG_TYPE_OPTIONS.map((o) => {
                  const active = form.organization_type === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setField("organization_type", o.value)}
                      className={`rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <div className="text-sm font-semibold">{o.label}</div>
                      <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                        {o.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Organisationsname">
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder={form.organization_type === "fitness_studio" ? "SGZ-Altenessen" : "Rot-Weiss Essen"}
              />
            </Field>
            <Field label="Kurzname (optional)">
              <Input
                value={form.short_name}
                onChange={(e) => setField("short_name", e.target.value)}
                placeholder="RWE"
              />
            </Field>
            <Field label="URL-Slug">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  bodyfuel-coaching.com/
                </span>
                <Input
                  value={autoSlug}
                  onChange={(e) => {
                    setField("slug", slugify(e.target.value));
                    setField("slugTouched", true);
                  }}
                  placeholder="rwe"
                />
              </div>
            </Field>
            <Field label="Claim / Untertitel (optional)">
              <Textarea
                rows={2}
                value={form.claim}
                onChange={(e) => setField("claim", e.target.value)}
                placeholder="Performance & Ernährung. Powered by BODYFUEL."
              />
            </Field>
          </div>
        )}


        {step === 2 && (
          <div className="grid gap-3">
            <Field label="Logo URL">
              <Input
                value={form.logo_url}
                onChange={(e) => setField("logo_url", e.target.value)}
                placeholder="https://…/logo.png"
              />
            </Field>
            <Field label="Alt-Logo / Icon (optional)">
              <Input
                value={form.alt_logo_url}
                onChange={(e) => setField("alt_logo_url", e.target.value)}
                placeholder="https://…/icon.png"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Primärfarbe" value={form.primary_color} onChange={(v) => setField("primary_color", v)} />
              <ColorField label="Sekundärfarbe" value={form.secondary_color} onChange={(v) => setField("secondary_color", v)} />
              <ColorField label="Akzentfarbe" value={form.accent_color} onChange={(v) => setField("accent_color", v)} />
              <ColorField label="Hintergrund" value={form.background_color} onChange={(v) => setField("background_color", v)} />
              <ColorField label="Textfarbe" value={form.text_color} onChange={(v) => setField("text_color", v)} />
            </div>
            <BrandingPreview form={form} />
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3">
            {form.organization_type === "sports_club" ? (
              <Field label="Sportart">
                <Input
                  value={form.sport}
                  onChange={(e) => setField("sport", e.target.value)}
                  placeholder="Fußball, Basketball, American Football …"
                />
              </Field>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Fitnessstudio-Organisation: keine Sportart nötig. Positionen und
                Mannschaftszuordnung entfallen automatisch für Mitglieder.
              </div>
            )}
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="mb-1 font-semibold text-foreground">Zusammenfassung</div>
              {form.name} · <code>/{autoSlug}</code>
              {" · "}
              {form.organization_type === "fitness_studio" ? "Fitnessstudio" : "Sportverein"}
              {form.organization_type === "sports_club" && form.sport ? ` · ${form.sport}` : ""}
              <div className="mt-2">
                Nach der Erstellung wirst du direkt in die Team-Verwaltung
                weitergeleitet. Dort legst du{" "}
                {form.organization_type === "fitness_studio"
                  ? "optionale Gruppen, Coaches und Mitglieder"
                  : "Mannschaften, Coaches und Athleten"}{" "}
                selbst an.
              </div>
            </div>
          </div>
        )}


        <DialogFooter className="flex justify-between gap-2 sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((step - 1) as 1 | 2 | 3)}>
                Zurück
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep((step + 1) as 1 | 2 | 3)}
                disabled={step === 1 && !canNext1}
              >
                Weiter
              </Button>
            ) : (
              <Button
                disabled={!canSubmit}
                onClick={() =>
                  create.mutate({
                    data: {
                      name: form.name.trim(),
                      slug: autoSlug,
                      organization_type: form.organization_type,
                      short_name: form.short_name.trim() || null,
                      sport:
                        form.organization_type === "fitness_studio"
                          ? null
                          : form.sport.trim() || null,
                      claim: form.claim.trim() || null,
                      logo_url: form.logo_url.trim() || null,
                      alt_logo_url: form.alt_logo_url.trim() || null,
                      primary_color: form.primary_color || null,
                      secondary_color: form.secondary_color || null,
                      accent_color: form.accent_color || null,
                      background_color: form.background_color || null,
                      text_color: form.text_color || null,
                    },
                  })

                }
              >
                {create.isPending ? "Erstelle…" : "Team erstellen"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function BrandingPreview({
  form,
}: {
  form: {
    name: string;
    short_name: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_color: string;
    text_color: string;
    logo_url: string;
  };
}) {
  return (
    <div
      className="mt-2 rounded-xl p-4"
      style={{ background: form.background_color, color: form.text_color }}
    >
      <div className="flex items-center gap-3">
        {form.logo_url ? (
          <img
            src={form.logo_url}
            alt="logo"
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div
            className="grid h-12 w-12 place-items-center rounded-full font-bold"
            style={{ background: form.primary_color, color: form.secondary_color }}
          >
            {(form.short_name || form.name || "??").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <div className="text-sm font-bold">{form.name || "Teamname"}</div>
          <div
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: form.accent_color, color: form.background_color }}
          >
            <Users className="mr-1 inline h-3 w-3" /> Performance-Team
          </div>
        </div>
      </div>
    </div>
  );
}
