import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, Dumbbell, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getNutritionTargets,
  setNutritionTargets,
  extractTargetsFromPlan,
} from "@/lib/nutrition.functions";
import { getNutritionTrackerTargets } from "@/lib/nutrition-tracker-targets.functions";

export function NutritionTargetsEditor({ userId }: { userId: string }) {
  const getFn = useServerFn(getNutritionTargets);
  const setFn = useServerFn(setNutritionTargets);
  const extractFn = useServerFn(extractTargetsFromPlan);
  const qc = useQueryClient();
  const getEffectiveFn = useServerFn(getNutritionTrackerTargets);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const { data: loaded, isLoading: loading } = useQuery({
    queryKey: ["nutrition-targets", userId],
    queryFn: () => getFn({ data: { user_id: userId } }),
  });

  const { data: effective } = useQuery({
    queryKey: ["nutrition-effective-targets", userId, today],
    queryFn: () => getEffectiveFn({ data: { user_id: userId, date: today } }),
  });

  const [kcal, setKcal] = useState(2200);
  const [protein, setProtein] = useState(150);
  const [carbs, setCarbs] = useState(220);
  const [fat, setFat] = useState(70);
  const [water, setWater] = useState(8);

  const [useRest, setUseRest] = useState(false);
  const [kcalR, setKcalR] = useState(2000);
  const [proteinR, setProteinR] = useState(150);
  const [carbsR, setCarbsR] = useState(170);
  const [fatR, setFatR] = useState(65);

  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Sync form state when DB values load or are auto-updated (z. B. nach Plan-Aktivierung).
  useEffect(() => {
    const t: any = loaded;
    if (!t) return;
    setKcal(t.kcal);
    setProtein(t.protein_g);
    setCarbs(t.carbs_g);
    setFat(t.fat_g);
    setWater(t.water_glasses);
    if (t.kcal_rest != null) {
      setUseRest(true);
      setKcalR(t.kcal_rest);
      setProteinR(t.protein_g_rest ?? t.protein_g);
      setCarbsR(t.carbs_g_rest ?? t.carbs_g);
      setFatR(t.fat_g_rest ?? t.fat_g);
    } else {
      setUseRest(false);
    }
  }, [loaded]);

  const extractFromPlan = async () => {
    setExtracting(true);
    try {
      const t = await extractFn({ data: { user_id: userId } });
      setKcal(t.kcal);
      setProtein(t.protein_g);
      setCarbs(t.carbs_g);
      setFat(t.fat_g);
      if (t.water_glasses) setWater(t.water_glasses);
      if (t.kcal_rest != null) {
        setUseRest(true);
        setKcalR(t.kcal_rest);
        setProteinR(t.protein_g_rest ?? t.protein_g);
        setCarbsR(t.carbs_g_rest ?? t.carbs_g);
        setFatR(t.fat_g_rest ?? t.fat_g);
        toast.success("Trainings- und Restday-Werte aus Plan übernommen.");
      } else {
        toast.success("Werte aus Plan übernommen — bitte prüfen & speichern.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

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
          kcal_rest: useRest ? kcalR : null,
          protein_g_rest: useRest ? proteinR : null,
          carbs_g_rest: useRest ? carbsR : null,
          fat_g_rest: useRest ? fatR : null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["nutrition-targets", userId] });
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
        Vorgaben für Kalorien, Makros und Wasser. Kalorien werden auf 50-er-Schritte gerundet.
      </p>
      {effective?.source === "active_plan" && (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
          <div className="font-semibold text-emerald-400">Aktiver Plan steuert aktuell das Tracking</div>
          <div className="mt-1 text-muted-foreground">
            Effektiv: {effective.kcal} kcal · P {effective.protein_g} g · KH {effective.carbs_g} g · F {effective.fat_g} g
            {effective.kcal_rest != null ? ` · Restday ${effective.kcal_rest} kcal` : ""}. Die Felder unten sind Fallback-Ziele für Zeiten ohne aktiven Plan.
          </div>
        </div>
      )}
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Lade…</p>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-3">
            <Dumbbell className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-semibold">Trainingstag {useRest ? "" : "(Standard)"}</h3>
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-5">
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

          <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-blue-400" />
              <div>
                <div className="text-sm font-semibold">Restday-Werte separat</div>
                <div className="text-[11px] text-muted-foreground">
                  An trainingsfreien Tagen werden automatisch diese Werte verwendet.
                </div>
              </div>
            </div>
            <Switch checked={useRest} onCheckedChange={setUseRest} />
          </div>

          {useRest && (
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label>kcal (Rest)</Label>
                <Input type="number" value={kcalR} onChange={(e) => setKcalR(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Protein (g)</Label>
                <Input type="number" value={proteinR} onChange={(e) => setProteinR(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Carbs (g)</Label>
                <Input type="number" value={carbsR} onChange={(e) => setCarbsR(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Fett (g)</Label>
                <Input type="number" value={fatR} onChange={(e) => setFatR(Number(e.target.value))} />
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
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
              {extracting ? "Lese Plan…" : "Aus aktuellem Plan extrahieren (Smart)"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Sobald ein Smart-Plan aktiv wird, werden Trainings- und Restday-Werte automatisch
            hier übernommen — du kannst sie jederzeit anpassen.
          </p>
        </>
      )}
    </div>
  );
}
