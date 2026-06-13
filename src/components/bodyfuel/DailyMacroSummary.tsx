import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getNutritionTargets, getDayType } from "@/lib/nutrition.functions";

type Totals = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
type Targets = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

const today = () => new Date().toISOString().slice(0, 10);

export function DailyMacroSummary({ userId }: { userId: string }) {
  const getTargetsFn = useServerFn(getNutritionTargets);
  const getDayFn = useServerFn(getDayType);
  const [totals, setTotals] = useState<Totals>({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  const [targets, setTargets] = useState<Targets | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const date = today();
      const [t, d, entries] = await Promise.all([
        getTargetsFn({ data: { user_id: userId } }).catch(() => null),
        getDayFn({ data: { user_id: userId, date } }).catch(() => null),
        supabase
          .from("food_entries")
          .select("kcal, protein_g, carbs_g, fat_g")
          .eq("user_id", userId)
          .eq("entry_date", date),
      ]);
      if (cancelled) return;
      if (t) {
        const useRest = d?.kind === "rest" && t.kcal_rest != null;
        setTargets({
          kcal: useRest ? (t.kcal_rest as number) : t.kcal,
          protein_g: useRest ? (t.protein_g_rest ?? t.protein_g) : t.protein_g,
          carbs_g: useRest ? (t.carbs_g_rest ?? t.carbs_g) : t.carbs_g,
          fat_g: useRest ? (t.fat_g_rest ?? t.fat_g) : t.fat_g,
        });
      }
      const list = (entries.data as Totals[]) ?? [];
      setTotals(
        list.reduce(
          (s, e) => ({
            kcal: s.kcal + Number(e.kcal),
            protein_g: s.protein_g + Number(e.protein_g),
            carbs_g: s.carbs_g + Number(e.carbs_g),
            fat_g: s.fat_g + Number(e.fat_g),
          }),
          { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        ),
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, getTargetsFn, getDayFn]);

  if (loading || !targets) return null;
  const rest = Math.max(0, targets.kcal - Math.round(totals.kcal));

  return (
    <Link
      to="/nutrition/tracking"
      className="group block rounded-2xl border border-border bg-card p-5 transition hover:border-gold/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Heute</p>
          <h2 className="font-display text-2xl font-bold">
            {Math.round(totals.kcal)} / {targets.kcal} kcal
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Rest: <span className="font-semibold text-gold">{rest} kcal</span>
          <ArrowRight className="h-4 w-4 text-gold transition group-hover:translate-x-1" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-3 text-center">
        <MacroCell color="hsl(var(--gold))" label="kcal" value={totals.kcal} target={targets.kcal} />
        <MacroCell color="#ef4444" label="Protein" value={totals.protein_g} target={targets.protein_g} unit="g" />
        <MacroCell color="#3b82f6" label="Carbs" value={totals.carbs_g} target={targets.carbs_g} unit="g" />
        <MacroCell color="#f59e0b" label="Fett" value={totals.fat_g} target={targets.fat_g} unit="g" />
      </div>
    </Link>
  );
}

function MacroCell({
  color,
  label,
  value,
  target,
  unit = "",
}: {
  color: string;
  label: string;
  value: number;
  target: number;
  unit?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span
        className="mb-2 h-2 w-2 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <div className="font-display text-2xl font-bold">{Math.round(value)}</div>
      <div className="text-[11px] text-muted-foreground">/ {target}{unit}</div>
      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
