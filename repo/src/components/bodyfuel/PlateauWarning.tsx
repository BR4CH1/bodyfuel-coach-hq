import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Zeigt eine Warnung, wenn das Gewicht seit ~10–21 Tagen stagniert
 * (Δ ≤ 0,3 kg). Empfiehlt eine Kalorien-Anpassung passend zum Ziel.
 */
export function PlateauWarning({
  userId,
  trainingGoal,
}: {
  userId: string | undefined;
  trainingGoal?: string | null;
}) {
  const [state, setState] = useState<{ days: number; diff: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("body_measurements")
        .select("weight_kg, measured_at")
        .eq("user_id", userId)
        .not("weight_kg", "is", null)
        .order("measured_at", { ascending: false })
        .limit(30);
      if (cancelled || !data || data.length < 2) return;
      const series = data.filter((m: any) => m.weight_kg != null);
      const latest = series[0];
      const now = Date.now();
      const olderRef = series.find((m: any) => {
        const age = (now - new Date(m.measured_at).getTime()) / 86400000;
        return age >= 10 && age <= 21;
      });
      if (!latest || !olderRef) return;
      const diff = Number((Number(latest.weight_kg) - Number(olderRef.weight_kg)).toFixed(2));
      if (Math.abs(diff) > 0.3) return;
      const days = Math.round((now - new Date(olderRef.measured_at).getTime()) / 86400000);
      setState({ days, diff });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!state) return null;

  const adjustment =
    trainingGoal === "fat_loss" || trainingGoal === "aggressive_cut" || trainingGoal === "weight_loss"
      ? "−100 bis −200 kcal"
      : trainingGoal === "lean_bulk" || trainingGoal === "muscle_gain"
        ? "+100 bis +200 kcal"
        : "±100 kcal nach Bedarf";

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className="font-display text-sm font-bold text-amber-200">Gewichtsplateau</p>
          <p className="mt-1 text-sm text-amber-100/90">
            Gewicht stagniert seit ~{state.days} Tagen. Empfehlung: Kalorien um {adjustment} anpassen.
            Der nächste Ernährungsplan berücksichtigt das automatisch.
          </p>
        </div>
      </div>
    </div>
  );
}
