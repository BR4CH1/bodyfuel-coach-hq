import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCustomerCoachingInfo } from "@/lib/coaching.functions";

const PRESETS = [6000, 8000, 10000, 12000];

export function StepGoalEditor({
  userId,
  initial,
}: {
  userId: string;
  initial: number | null | undefined;
}) {
  const [val, setVal] = useState<number>(initial ?? 10000);
  const qc = useQueryClient();
  const updFn = useServerFn(updateCustomerCoachingInfo);

  const mut = useMutation({
    mutationFn: async (n: number) =>
      updFn({ data: { user_id: userId, daily_step_goal: n } }),
    onSuccess: () => {
      toast.success("Schrittziel gespeichert");
      qc.invalidateQueries({ queryKey: ["customer-detail", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Speichern fehlgeschlagen"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-gold">
        <Footprints className="h-5 w-5" />
        <h2 className="font-display text-lg font-bold text-foreground">
          Tägliches Schrittziel
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Individuell je nach körperlicher Verfassung &amp; Bewegungsniveau.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setVal(p)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              val === p
                ? "border-gold bg-gold/10 text-gold"
                : "border-border text-muted-foreground hover:border-gold/40"
            }`}
          >
            {p.toLocaleString("de-DE")}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Eigener Wert (Schritte/Tag)
          </label>
          <Input
            type="number"
            min={1000}
            max={40000}
            step={500}
            value={val}
            onChange={(e) => setVal(Number(e.target.value))}
            className="mt-1"
          />
        </div>
        <Button
          onClick={() => mut.mutate(val)}
          disabled={mut.isPending}
          className="bg-gradient-gold text-primary-foreground"
        >
          {mut.isPending ? "Speichern…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
