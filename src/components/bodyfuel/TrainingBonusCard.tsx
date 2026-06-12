import { useEffect, useState, useCallback } from "react";
import { Dumbbell, Trophy, TrendingUp, Flame, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type PP = {
  id: string;
  exercise_id: string | null;
  exercise_name: string | null;
  training_date: string;
  kind: string;
  points: number;
  details: Record<string, unknown>;
  flagged: boolean;
  approved: boolean;
  created_at: string;
};

const KIND_META: Record<string, { label: string; icon: typeof Trophy; color: string }> = {
  pr_weight: { label: "Gewichts-PR", icon: Trophy, color: "text-gold" },
  pr_e1rm: { label: "e1RM-PR", icon: Trophy, color: "text-gold" },
  pr_volume: { label: "Volumen-PR", icon: Trophy, color: "text-gold" },
  pr_reps: { label: "Reps-PR", icon: Trophy, color: "text-gold" },
  improvement: { label: "Verbesserung", icon: TrendingUp, color: "text-emerald-500" },
  streak_7: { label: "7-Tage-Trainingsstreak", icon: Flame, color: "text-orange-500" },
  streak_30: { label: "30-Tage-Trainingsstreak", icon: Flame, color: "text-orange-500" },
};

function detailsText(p: PP): string {
  const d = p.details as Record<string, number | string>;
  if (p.kind === "pr_weight") return `${d.new} kg (vorher ${d.prev ?? "—"} kg)`;
  if (p.kind === "pr_e1rm") return `e1RM ${d.new} (vorher ${d.prev ?? "—"})`;
  if (p.kind === "pr_volume") return `Volumen ${d.new} kg·Wdh.`;
  if (p.kind === "pr_reps") return `${d.new} Wdh. (vorher ${d.prev ?? "—"})`;
  if (p.kind === "improvement") return `e1RM ${d.new} vs. letzte Einheit ${d.last}`;
  if (p.kind === "streak_7" || p.kind === "streak_30") return `${d.days} Trainingstage`;
  return "";
}

export function TrainingBonusCard({
  userId,
  isCoach = false,
}: {
  userId: string;
  isCoach?: boolean;
}) {
  const [items, setItems] = useState<PP[]>([]);
  const [loading, setLoading] = useState(true);
  const sinceDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("performance_points")
      .select("*")
      .eq("user_id", userId)
      .gte("training_date", sinceDate)
      .order("created_at", { ascending: false });
    setItems((data as PP[]) ?? []);
    setLoading(false);
  }, [userId, sinceDate]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const approvedItems = items.filter((i) => i.approved);
  const flaggedItems = items.filter((i) => i.flagged && !i.approved);
  const weekTotal = approvedItems.reduce((s, i) => s + i.points, 0);

  const prCount = approvedItems.filter((i) => i.kind.startsWith("pr_")).length;
  const impCount = approvedItems.filter((i) => i.kind === "improvement").length;
  const streakCount = approvedItems.filter((i) => i.kind.startsWith("streak_")).length;

  const handleApprove = async (id: string, approve: boolean) => {
    const { error } = await supabase
      .from("performance_points")
      .update(approve ? { approved: true, flagged: false } : { approved: false })
      .eq("id", id);
    if (error) {
      toast.error("Konnte nicht aktualisieren");
      return;
    }
    toast.success(approve ? "Punkte freigegeben" : "Eintrag verworfen");
    if (!approve) {
      await supabase.from("performance_points").delete().eq("id", id);
    }
    load();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-gold">
          <Dumbbell className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider">Trainingsbonus diese Woche</span>
        </div>
        <div className="font-display text-2xl font-bold text-gold">+{weekTotal}</div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini label="Verbessert" value={impCount} />
        <Mini label="Bestleistungen" value={prCount} />
        <Mini label="Streaks" value={streakCount} />
      </div>

      {flaggedItems.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            Ungewöhnlicher Fortschritt
          </div>
          <ul className="mt-2 space-y-2">
            {flaggedItems.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-background/40 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.exercise_name ?? "—"}</div>
                  <div className="text-muted-foreground">{detailsText(p)}</div>
                </div>
                {isCoach ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => handleApprove(p.id, true)}
                      className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                      aria-label="Bestätigen"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleApprove(p.id, false)}
                      className="grid h-7 w-7 place-items-center rounded-md bg-red-500/20 text-red-500 hover:bg-red-500/30"
                      aria-label="Verwerfen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 text-[10px] uppercase text-amber-500">
                    Coach prüft
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {loading && (
          <li className="text-xs text-muted-foreground">Lade…</li>
        )}
        {!loading && approvedItems.length === 0 && (
          <li className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
            Diese Woche noch keine Trainingsbonus-Punkte — los geht's!
          </li>
        )}
        {approvedItems.slice(0, 8).map((p) => {
          const meta = KIND_META[p.kind] ?? {
            label: p.kind,
            icon: Trophy,
            color: "text-foreground",
          };
          const Icon = meta.icon;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {p.exercise_name ?? meta.label}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {meta.label} · {detailsText(p)}
                  </div>
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-gold">+{p.points}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2 text-center">
      <div className="font-display text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
