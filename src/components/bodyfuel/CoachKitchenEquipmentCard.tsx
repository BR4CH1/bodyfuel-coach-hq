import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChefHat, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  getCustomerSmartProfile,
  setCustomerKitchenEquipment,
} from "@/lib/smart-profile.functions";

const PRESETS = [
  "Herd",
  "Backofen",
  "Airfryer",
  "Mikrowelle",
  "Mixer",
  "Pürierstab",
  "Grill",
  "Slow Cooker",
  "Sandwichmaker",
  "Reiskocher",
  "Wasserkocher",
  "Toaster",
];

export function CoachKitchenEquipmentCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getCustomerSmartProfile);
  const saveFn = useServerFn(setCustomerKitchenEquipment);

  const queryKey = ["smart-profile-equipment", userId];
  const { data: profile, isLoading } = useQuery({
    queryKey,
    queryFn: () => getFn({ data: { user_id: userId } }),
    enabled: !!userId,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (profile) {
      setSelected(new Set(profile.kitchen_equipment ?? []));
      setNotes(profile.kitchen_equipment_notes ?? "");
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          user_id: userId,
          kitchen_equipment: Array.from(selected),
          kitchen_equipment_notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Küchenausstattung gespeichert");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const toggle = (item: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <ChefHat className="h-5 w-5 text-gold" />
        <h2 className="font-display text-lg font-bold">Küchenausstattung</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Welche Geräte hat der Kunde verfügbar? Die KI wird Rezepte so wählen, dass sie damit
        zubereitbar sind (z. B. „nur Airfryer, kein Herd“).
      </p>

      {isLoading ? (
        <div className="rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">Lade…</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {PRESETS.map((item) => {
              const on = selected.has(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggle(item)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    on
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-border bg-background/40 text-muted-foreground hover:border-gold/50"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={600}
            rows={2}
            placeholder='Zusatznotizen, z. B. "Kein Herd, nur Airfryer + Mikrowelle. Kleiner Backofen."'
            className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-2 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Speichern
          </button>
        </>
      )}
    </div>
  );
}
