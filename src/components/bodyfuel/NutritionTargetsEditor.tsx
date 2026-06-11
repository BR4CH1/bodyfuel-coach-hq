import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getNutritionTargets,
  setNutritionTargets,
  extractTargetsFromPlan,
} from "@/lib/nutrition.functions";

export function NutritionTargetsEditor({ userId }: { userId: string }) {
  const getFn = useServerFn(getNutritionTargets);
  const setFn = useServerFn(setNutritionTargets);
  const extractFn = useServerFn(extractTargetsFromPlan);
  const [kcal, setKcal] = useState(2200);
  const [protein, setProtein] = useState(150);
  const [carbs, setCarbs] = useState(220);
  const [fat, setFat] = useState(70);
  const [water, setWater] = useState(8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const extractFromPlan = async () => {
    setExtracting(true);
    try {
      const t = await extractFn({ data: { user_id: userId } });
      setKcal(t.kcal);
      setProtein(t.protein_g);
      setCarbs(t.carbs_g);
      setFat(t.fat_g);
      if (t.water_glasses) setWater(t.water_glasses);
      toast.success("Werte aus Plan übernommen — bitte prüfen & speichern.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await getFn({ data: { user_id: userId } });
        if (cancelled) return;
        if (t) {
          setKcal(t.kcal);
          setProtein(t.protein_g);
          setCarbs(t.carbs_g);
          setFat(t.fat_g);
          setWater(t.water_glasses);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, getFn]);

  const save = async () => {
    setSaving(true);
    try {
      await setFn({
        data: {
          user_id: userId,
          kcal,
          protein_g: protein,
          carbs_g: carbs,
          fat_g: fat,
          water_glasses: water,
        },
      });
      toast.success("Ziele gespeichert.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-bold">Ernährungsziele</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Vorgaben für Kalorien, Makros und Wasser. Der Kunde sieht das im Tracking.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Lade…</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            <div className="space-y-1">
              <Label>kcal</Label>
              <Input type="number" value={kcal} onChange={(e) => setKcal(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Protein (g)</Label>
              <Input type="number" value={protein} onChange={(e) => setProtein(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Carbs (g)</Label>
              <Input type="number" value={carbs} onChange={(e) => setCarbs(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Fett (g)</Label>
              <Input type="number" value={fat} onChange={(e) => setFat(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Wasser (Gläser à 0,25 L)</Label>
              <Input type="number" value={water} onChange={(e) => setWater(Number(e.target.value))} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={save}
              disabled={saving}
              className="bg-gradient-gold text-primary-foreground"
            >
              {saving ? "Speichere…" : "Speichern"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={extractFromPlan}
              disabled={extracting}
            >
              {extracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {extracting ? "Lese Plan…" : "Aus aktuellem Plan extrahieren (KI)"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Die KI liest die kcal- und Makro-Werte aus dem aktiven Ernährungsplan-PDF.
            Danach bitte prüfen und speichern.
          </p>
        </>
      )}
    </div>
  );
}
