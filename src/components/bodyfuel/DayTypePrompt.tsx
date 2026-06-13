import { useEffect, useState } from "react";
import { Dumbbell, Moon, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getDayType, setDayType, type DayType } from "@/lib/nutrition.functions";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Prompts the user once per day to pick training/rest. Hides itself once the
 * user has chosen (source === "manual"). After choice the page reloads so the
 * nutrition plan picks a matching day.
 */
export function DayTypePrompt({ userId, onChosen }: { userId: string; onChosen?: (k: DayType) => void }) {
  const getFn = useServerFn(getDayType);
  const setFn = useServerFn(setDayType);
  const [needsChoice, setNeedsChoice] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<DayType | null>(null);
  const date = today();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getFn({ data: { user_id: userId, date } });
        if (!cancelled) setNeedsChoice(d.source !== "manual");
      } catch {
        if (!cancelled) setNeedsChoice(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, date, getFn]);

  if (!needsChoice) return null;

  const choose = async (kind: DayType) => {
    setBusy(kind);
    try {
      await setFn({ data: { user_id: userId, date, kind } });
      setNeedsChoice(false);
      toast.success(kind === "training" ? "Trainingstag gesetzt" : "Restday gesetzt");
      onChosen?.(kind);
    } catch (e: any) {
      toast.error(e?.message ?? "Konnte nicht speichern");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 to-transparent p-5">
      <div className="text-xs uppercase tracking-wider text-gold">Heutiger Tag</div>
      <div className="mt-1 font-display text-lg font-bold">
        Trainingstag oder Restday?
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Wir wählen dann automatisch einen passenden Tag aus deinem Plan.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => choose("training")}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 rounded-xl border border-gold/50 bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold transition hover:opacity-90 disabled:opacity-60"
        >
          {busy === "training" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dumbbell className="h-4 w-4" />}
          Trainingstag
        </button>
        <button
          onClick={() => choose("rest")}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-400/10 px-4 py-3 text-sm font-semibold text-blue-200 transition hover:bg-blue-400/20 disabled:opacity-60"
        >
          {busy === "rest" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Moon className="h-4 w-4" />}
          Restday
        </button>
      </div>
    </div>
  );
}
