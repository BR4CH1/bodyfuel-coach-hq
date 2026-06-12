import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Utensils, ChevronRight, Dumbbell, Moon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { PlansView } from "@/components/bodyfuel/PlansView";
import { useSession } from "@/lib/bodyfuel/session";
import { getNutritionTargets } from "@/lib/nutrition.functions";

export const Route = createFileRoute("/nutrition/")({
  head: () => ({ meta: [{ title: "Ernährungsplan — BODYFUEL" }] }),
  component: NutritionIndex,
});

function NutritionIndex() {
  const { isCoach } = useSession();
  return (
    <AppLayout>
      <div className="space-y-5">
        {!isCoach && (
          <>
            <Link
              to="/nutrition/tracking"
              className="flex items-center justify-between gap-3 rounded-2xl border border-gold/50 bg-gradient-to-br from-accent/40 to-card p-4 transition hover:border-gold"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold text-primary-foreground">
                  <Utensils className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">Essen tracken</div>
                  <div className="text-xs text-muted-foreground">
                    Kalorien, Makros & Wasser — mit Barcode-Scanner
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gold" />
            </Link>
            <MacroTargetsCard />
          </>
        )}
        <PlansView planType="nutrition" />
      </div>
    </AppLayout>
  );
}

function MacroTargetsCard() {
  const { supabaseUser } = useSession();
  const uid = supabaseUser?.id;
  const getFn = useServerFn(getNutritionTargets);
  const [t, setT] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await getFn({ data: { user_id: uid } });
        if (!cancelled) setT(row);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, getFn]);

  if (loading || !t) return null;

  const hasRest = t.kcal_rest != null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold">Deine Tageswerte</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {hasRest
          ? "Trainingstage und Restdays nutzen unterschiedliche Macros."
          : "Aktuell ist kein Restday-Wert hinterlegt — frag deinen Coach."}
      </p>
      <div className={`mt-4 grid gap-3 ${hasRest ? "sm:grid-cols-2" : ""}`}>
        <MacroBlock
          tone="training"
          title="Trainingstag"
          kcal={t.kcal}
          p={t.protein_g}
          c={t.carbs_g}
          f={t.fat_g}
        />
        {hasRest && (
          <MacroBlock
            tone="rest"
            title="Restday"
            kcal={t.kcal_rest}
            p={t.protein_g_rest ?? t.protein_g}
            c={t.carbs_g_rest ?? t.carbs_g}
            f={t.fat_g_rest ?? t.fat_g}
          />
        )}
      </div>
    </div>
  );
}

function MacroBlock({
  tone,
  title,
  kcal,
  p,
  c,
  f,
}: {
  tone: "training" | "rest";
  title: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
}) {
  const isTraining = tone === "training";
  return (
    <div
      className={`rounded-xl border p-4 ${
        isTraining
          ? "border-gold/50 bg-gradient-to-br from-accent/40 to-card"
          : "border-blue-400/40 bg-blue-400/10"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`grid h-9 w-9 place-items-center rounded-lg ${
            isTraining
              ? "bg-gradient-gold text-primary-foreground"
              : "bg-blue-400/20 text-blue-300"
          }`}
        >
          {isTraining ? <Dumbbell className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </div>
        <div className="font-display text-base font-bold">{title}</div>
      </div>
      <div className="mt-3 font-display text-2xl font-bold">{kcal} kcal</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <MacroPill label="Protein" value={`${p} g`} />
        <MacroPill label="Kohlh." value={`${c} g`} />
        <MacroPill label="Fett" value={`${f} g`} />
      </div>
    </div>
  );
}

function MacroPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/40 p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-sm font-bold">{value}</div>
    </div>
  );
}
