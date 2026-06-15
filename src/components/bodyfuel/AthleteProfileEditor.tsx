import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save, Dumbbell } from "lucide-react";
import { updateCustomerCoachingInfo } from "@/lib/coaching.functions";

type Experience = "beginner" | "intermediate" | "advanced";

export function AthleteProfileEditor({
  userId,
  initialSport,
  initialInjuries,
  initialExperience,
}: {
  userId: string;
  initialSport: string | null;
  initialInjuries: string | null;
  initialExperience: Experience | null;
}) {
  const [sport, setSport] = useState(initialSport ?? "");
  const [injuries, setInjuries] = useState(initialInjuries ?? "");
  const [experience, setExperience] = useState<Experience | "">(
    initialExperience ?? "",
  );
  const updateFn = useServerFn(updateCustomerCoachingInfo);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          user_id: userId,
          sport: sport.trim() || null,
          injuries: injuries.trim() || null,
          training_experience: (experience || null) as Experience | null,
        },
      }),
    onSuccess: () => {
      toast.success("Trainings-Profil gespeichert");
      qc.invalidateQueries({ queryKey: ["customer-detail", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Dumbbell className="h-4 w-4 text-gold" />
        <h3 className="font-display text-base font-bold">Trainings-Profil</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Diese Daten fließen direkt in die Smart-Trainingsplan-Erstellung der KI ein.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Trainings-Erfahrung
          </label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {(["beginner", "intermediate", "advanced"] as Experience[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setExperience(opt)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  experience === opt
                    ? "border-gold bg-gold/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt === "beginner" ? "Anfänger" : opt === "intermediate" ? "Mittel" : "Fortg."}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Sportart (optional)
          </label>
          <input
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            placeholder="z. B. Football, Kampfsport, Fußball"
            maxLength={80}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Verletzungen / Einschränkungen (optional)
          </label>
          <textarea
            value={injuries}
            onChange={(e) => setInjuries(e.target.value)}
            placeholder="z. B. Knieprobleme links, Schulterimpingement"
            maxLength={500}
            rows={2}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Speichern
        </button>
      </div>
    </div>
  );
}
