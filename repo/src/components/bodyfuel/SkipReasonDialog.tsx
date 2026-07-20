import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { logMealSkip, SKIP_REASONS } from "@/lib/meal-skips.functions";

type Props = {
  mealId: string;
  mealName: string;
  onClose: () => void;
  onSkipped: () => void;
};

export function SkipReasonDialog({ mealId, mealName, onClose, onSkipped }: Props) {
  const skipFn = useServerFn(logMealSkip);
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return toast.error("Bitte einen Grund wählen.");
    setBusy(true);
    try {
      await skipFn({
        data: { meal_id: mealId, meal_name: mealName, reason, note: note.trim() || undefined },
      });
      toast.success("Übersprungen. Wir passen deinen Plan an.");
      onSkipped();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Übersprungen</div>
            <h3 className="font-display text-lg font-bold">{mealName}</h3>
            <p className="mt-1 text-xs text-muted-foreground">Warum hast du diese Mahlzeit nicht gegessen?</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {SKIP_REASONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setReason(r.key)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                reason === r.key
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border bg-background/40 text-foreground/80 hover:border-gold/50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Notiz (optional)…"
          className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !reason}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
