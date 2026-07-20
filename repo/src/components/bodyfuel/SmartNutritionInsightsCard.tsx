import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  getCustomerSmartProfile,
  getCustomerRiskFlags,
  getCustomerSkipBreakdown,
  setCustomerAutoPublish,
} from "@/lib/coach-smart-insights.functions";
import { SKIP_REASONS } from "@/lib/meal-skips.functions";


const REASON_LABEL: Record<string, string> = Object.fromEntries(
  SKIP_REASONS.map((r) => [r.key, r.label]),
);

export function SmartNutritionInsightsCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const profileFn = useServerFn(getCustomerSmartProfile);
  const riskFn = useServerFn(getCustomerRiskFlags);
  const skipFn = useServerFn(getCustomerSkipBreakdown);
  const autoFn = useServerFn(setCustomerAutoPublish);
  

  const profile = useQuery({
    queryKey: ["smart-profile", userId],
    queryFn: () => profileFn({ data: { user_id: userId } }),
  });
  const risk = useQuery({
    queryKey: ["risk-flags", userId],
    queryFn: () => riskFn({ data: { user_id: userId } }),
  });
  const skips = useQuery({
    queryKey: ["skip-breakdown", userId],
    queryFn: () => skipFn({ data: { user_id: userId } }),
  });

  const toggleAuto = useMutation({
    mutationFn: (val: boolean) => autoFn({ data: { user_id: userId, auto_publish: val } }),
    onSuccess: () => {
      toast.success("Gespeichert.");
      qc.invalidateQueries({ queryKey: ["smart-profile", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = profile.data?.profile ?? null;
  const flags = risk.data?.flags ?? [];
  const stats = risk.data?.stats;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Smart-Nutrition</h2>
        <p className="text-xs text-muted-foreground">
          Profil, Vorlieben und Risiko-Flags der letzten 14 Tage.
        </p>
      </div>

      {/* Risk flags */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Risiko-Flags</h3>
        {risk.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Lade…</p>
        ) : flags.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-500">✓ Keine Auffälligkeiten.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {flags.map((f: any) => {
              const Icon = f.severity === "critical" ? ShieldAlert : AlertTriangle;
              const color =
                f.severity === "critical"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-amber-500/50 bg-amber-500/10 text-amber-500";
              return (
                <div key={f.key} className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${color}`}>
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">{f.label}</div>
                    <div className="opacity-90">{f.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {stats && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
            <Mini label="Gegessen 14T" value={stats.eaten} />
            <Mini label="Übersprungen" value={stats.skips} />
            <Mini label="Getauscht" value={stats.swaps} />
            <Mini
              label="Ø Protein"
              value={stats.target_protein ? `${stats.avg_protein}/${stats.target_protein}g` : `${stats.avg_protein}g`}
            />
          </div>
        )}
      </div>

      {/* Profile snapshot */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Profil</h3>
        {profile.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Lade…</p>
        ) : !p ? (
          <p className="mt-2 text-sm text-muted-foreground">Kunde hat das Smart-Nutrition-Profil noch nicht ausgefüllt.</p>
        ) : (
          <div className="mt-2 space-y-2 text-xs">
            <Row label="Allergien" value={joinList(p.allergies, p.extra_allergies)} muted="(keine)" />
            <Row label="No-Go" value={joinList(p.nogo_foods, p.extra_nogos)} muted="(keine)" />
            <Row label="Lieblings-Foods" value={joinList(p.favorite_foods, p.extra_favorites)} muted="—" />
            <Row label="Meal-Prep-Stil" value={p.meal_prep_style ?? "—"} />
            <Row label="Einkaufstage" value={(p.shopping_days && p.shopping_days.length) ? p.shopping_days.join(", ") : (p.shopping_day ?? "—")} />
            <Row
              label="Trainingstage"
              value={(p as any).training_weekdays?.length ? (p as any).training_weekdays.join(", ") : ""}
              muted="⚠ noch nicht gesetzt"
            />
            <Row label="Budget" value={p.budget_band ?? "—"} />
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id={`auto-${userId}`}
                checked={!!p.auto_publish}
                disabled={toggleAuto.isPending}
                onChange={(e) => toggleAuto.mutate(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor={`auto-${userId}`} className="text-xs">
                Auto-Publish: Pläne automatisch aktivieren (sonst Coach-Freigabe nötig)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Skip breakdown */}
      {(skips.data?.reasons?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Skip-Gründe (30 Tage)
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {skips.data!.reasons.map((r: any) => (
              <span
                key={r.reason}
                className="rounded-full border border-border bg-secondary/30 px-2 py-1 text-[11px]"
              >
                {REASON_LABEL[r.reason] ?? r.reason}: <strong>{r.count}</strong>
              </span>
            ))}
          </div>
          {(skips.data?.meals?.length ?? 0) > 0 && (
            <div className="mt-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Meist übersprungene Mahlzeiten
              </div>
              <ul className="mt-1 space-y-0.5 text-xs">
                {skips.data!.meals.slice(0, 5).map((m: any) => (
                  <li key={m.name} className="flex justify-between">
                    <span className="truncate pr-2">{m.name}</span>
                    <span className="text-muted-foreground">{m.count}×</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1">{value || muted || "—"}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

function joinList(arr?: string[] | null, extra?: string | null): string {
  const items = [
    ...(arr ?? []),
    ...((extra ?? "").split(",").map((s) => s.trim()).filter(Boolean)),
  ];
  return items.join(", ");
}
