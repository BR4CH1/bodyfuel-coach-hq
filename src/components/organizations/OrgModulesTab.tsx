import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listOrganizationFeatures,
  setOrganizationFeature,
} from "@/lib/organizations/organizations.functions";
import {
  ORG_MODULES,
  moduleFeatureKeys,
  type OrgModuleDef,
} from "@/lib/organizations/modules";

type FeatureRow = { feature: string; enabled: boolean };

function moduleEnabled(features: FeatureRow[], def: OrgModuleDef): boolean {
  const keys = moduleFeatureKeys(def);
  return features.some((f) => keys.includes(f.feature) && f.enabled);
}

export function OrgModulesTab({
  orgId,
  orgSlug,
  canManage,
}: {
  orgId: string;
  orgSlug: string | null | undefined;
  canManage: boolean;
}) {
  const listFn = useServerFn(listOrganizationFeatures);
  const setFn = useServerFn(setOrganizationFeature);
  const qc = useQueryClient();

  const canToggle = canManage;


  const { data: features = [], isLoading } = useQuery({
    queryKey: ["org-features", orgId],
    queryFn: () => listFn({ data: { orgId } }),
  });

  const featuresList = features as FeatureRow[];

  const toggle = useMutation({
    mutationFn: async (args: { def: OrgModuleDef; enabled: boolean }) => {
      const keys = moduleFeatureKeys(args.def);
      return setFn({
        data: { orgId, features: keys, enabled: args.enabled },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-features", orgId] });
      qc.invalidateQueries({ queryKey: ["coach-org-detail", orgId] });
    },
  });

  const summary = useMemo(() => {
    const active = ORG_MODULES.filter((m) => moduleEnabled(featuresList, m)).map((m) => m.label);
    return active;
  }, [featuresList]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Lädt Module…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold">Module dieser Organisation</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Deaktivierte Module werden für Athleten und Coaches vollständig
          ausgeblendet. Die zentrale BodyFuel-Engine bleibt erhalten — es wird
          lediglich diese Organisation eingeschränkt.
        </p>
        {!canManage && (
          <p className="mt-3 rounded-lg border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
            Nur Vereinsleitung und Plattform-Owner können Module aktivieren.
          </p>
        )}

        <div className="mt-4 grid gap-2">
          {ORG_MODULES.map((m) => {
            const on = moduleEnabled(featuresList, m);
            const busy = toggle.isPending && toggle.variables?.def.key === m.key;
            return (
              <div
                key={m.key}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/40 p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold">{m.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.description}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canToggle || busy}
                  onClick={() => toggle.mutate({ def: m, enabled: !on })}
                  className={`relative shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                    on
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  } ${!canToggle || busy ? "opacity-60" : ""}`}
                >
                  {busy ? "…" : on ? "AN" : "AUS"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold">Aktive Module</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          So sieht die Navigation für diese Organisation aktuell aus (basierend
          auf den aktiven Modulen).
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {summary.length === 0 ? (
            <span className="text-xs text-muted-foreground">Keine Module aktiv.</span>
          ) : (
            summary.map((label) => (
              <span
                key={label}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500"
              >
                {label}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
