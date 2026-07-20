import { useEffect, useState } from "react";
import { Dumbbell, Moon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getNutritionTargets } from "@/lib/nutrition.functions";
import {
  getBullsDailyNutritionTargets,
  type BullsMacroDTO,
} from "@/lib/performance-nutrition/bulls-nutrition.functions";

type Variant = "personal" | "bulls";

export function MacroTargetsCard({
  userId,
  variant = "personal",
}: {
  userId: string | undefined;
  variant?: Variant;
}) {
  if (variant === "bulls") return <BullsMacroTargetsCard />;
  return <PersonalMacroTargetsCard userId={userId} />;
}

function PersonalMacroTargetsCard({ userId }: { userId: string | undefined }) {
  const getFn = useServerFn(getNutritionTargets);
  const [t, setT] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await getFn({ data: { user_id: userId } });
        if (!cancelled) setT(row);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, getFn]);

  if (loading || !t) return null;

  const hasRest = t.kcal_rest != null;
  return (
    <Card
      hasRest={hasRest}
      subtitle={
        hasRest
          ? "Trainingstage und Restdays nutzen unterschiedliche Macros."
          : "Aktuell ist kein Restday-Wert hinterlegt."
      }
      training={{
        kcal: t.kcal,
        protein_g: t.protein_g,
        carbs_g: t.carbs_g,
        fat_g: t.fat_g,
      }}
      rest={
        hasRest
          ? {
              kcal: t.kcal_rest,
              protein_g: t.protein_g_rest ?? t.protein_g,
              carbs_g: t.carbs_g_rest ?? t.carbs_g,
              fat_g: t.fat_g_rest ?? t.fat_g,
            }
          : null
      }
    />
  );
}

function BullsMacroTargetsCard() {
  const fn = useServerFn(getBullsDailyNutritionTargets);
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useQuery({
    queryKey: ["bulls-nutrition-targets", today],
    queryFn: () => fn({ data: { date: today } }),
  });

  if (isLoading || !data) return null;

  if (data.needsProfile || !data.trainingTargets || !data.restTargets) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">Tageswerte</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ergänze dein Performance-Profil (Größe, Gewicht, Geschlecht, Alltagsaktivität,
          Ziel), damit deine Tageswerte berechnet werden können.
        </p>
      </div>
    );
  }

  return (
    <Card
      hasRest
      subtitle="Trainingstage und Restdays nutzen unterschiedliche Macros — berechnet auf Basis deines Performance-Profils."
      training={data.trainingTargets}
      rest={data.restTargets}
    />
  );
}

function Card({
  hasRest,
  subtitle,
  training,
  rest,
}: {
  hasRest: boolean;
  subtitle: string;
  training: BullsMacroDTO;
  rest: BullsMacroDTO | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold">Tageswerte</h2>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      <div className={`mt-4 grid gap-3 ${hasRest ? "sm:grid-cols-2" : ""}`}>
        <MacroBlock
          tone="training"
          title="Trainingstag"
          kcal={training.kcal}
          p={training.protein_g}
          c={training.carbs_g}
          f={training.fat_g}
        />
        {hasRest && rest && (
          <MacroBlock
            tone="rest"
            title="Restday"
            kcal={rest.kcal}
            p={rest.protein_g}
            c={rest.carbs_g}
            f={rest.fat_g}
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
