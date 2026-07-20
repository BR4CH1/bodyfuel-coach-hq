import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Salad, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { getMySmartProfile, saveSmartProfile } from "@/lib/smart-profile.functions";

type Diet =
  | "omnivore"
  | "flexitarian"
  | "pescetarian"
  | "vegetarian"
  | "vegan"
  | "other";

const OPTIONS: { value: Diet; label: string; desc: string }[] = [
  { value: "omnivore", label: "Alles", desc: "Fleisch, Fisch & pflanzlich" },
  { value: "flexitarian", label: "Flexitarisch", desc: "Wenig Fleisch" },
  { value: "pescetarian", label: "Pescetarisch", desc: "Fisch, kein Fleisch" },
  { value: "vegetarian", label: "Vegetarisch", desc: "Ohne Fleisch/Fisch" },
  { value: "vegan", label: "Vegan", desc: "Rein pflanzlich" },
  { value: "other", label: "Andere / individuell", desc: "Details unten angeben" },
];

export function DietPreferencesCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMySmartProfile);
  const saveFn = useServerFn(saveSmartProfile);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["smart-profile-diet"],
    queryFn: () => getFn(),
  });

  const [style, setStyle] = useState<Diet>("omnivore");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (profile) {
      setStyle((profile.diet_style as Diet) ?? "omnivore");
      setNotes(profile.diet_notes ?? "");
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          diet_style: style,
          diet_notes: notes.trim() ? notes.trim().slice(0, 600) : null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-profile-diet"] });
      qc.invalidateQueries({ queryKey: ["smart-profile"] });
      toast.success("Ernährungsform gespeichert – gilt ab dem nächsten Plan.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Salad className="h-5 w-5 text-emerald-500" />
        <h2 className="font-display text-lg font-bold">Ernährungsform</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Wähle deine Ernährungsweise. Änderungen werden bei der nächsten
        Planerstellung und bei Rezept-Tauschvorschlägen automatisch berücksichtigt.
      </p>

      {isLoading ? (
        <div className="rounded-xl bg-background/40 p-4 text-sm text-muted-foreground">
          Lade…
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OPTIONS.map((o) => {
              const active = style === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setStyle(o.value)}
                  className={`rounded-xl border p-2 text-left text-xs transition ${
                    active
                      ? "border-gold bg-gold/10"
                      : "border-border bg-background/40 hover:border-gold/50"
                  }`}
                >
                  <div className="text-sm font-bold">{o.label}</div>
                  <div className="text-[11px] text-muted-foreground">{o.desc}</div>
                </button>
              );
            })}
          </div>

          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            Zusätzliche Hinweise (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={600}
            rows={3}
            placeholder="z. B. laktosefrei, kein Schweinefleisch, wenig Soja …"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
          />

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="flex items-center gap-2 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Speichern
            </button>
          </div>
        </>
      )}
    </div>
  );
}
