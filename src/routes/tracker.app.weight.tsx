import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoachingLockTeaser } from "@/components/bodyfuel/CoachingLockTeaser";

export const Route = createFileRoute("/tracker/app/weight")({
  head: () => ({ meta: [{ title: "Gewicht — BodyFuel Tracker" }] }),
  component: WeightPage,
});

function WeightPage() {
  const { supabaseUser } = useSession();
  const [weight, setWeight] = useState("");
  const [history, setHistory] = useState<{ date: string; w: number }[]>([]);

  const load = async () => {
    if (!supabaseUser) return;
    const { data } = await supabase
      .from("body_measurements")
      .select("weight_kg, measured_at")
      .eq("user_id", supabaseUser.id)
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false })
      .limit(30);
    setHistory(
      (data ?? []).map((r: any) => ({
        date: new Date(r.measured_at).toLocaleDateString("de-DE"),
        w: Number(r.weight_kg),
      })),
    );
  };

  useEffect(() => { load(); }, [supabaseUser]);

  const save = async () => {
    if (!supabaseUser) return;
    const v = parseFloat(weight.replace(",", "."));
    if (!v || v <= 0 || v > 400) return toast.error("Bitte gültiges Gewicht eingeben");
    const { error } = await supabase.from("body_measurements").insert({
      user_id: supabaseUser.id,
      weight_kg: v,
      measured_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Gewicht gespeichert");
    setWeight("");
    load();
  };

  const latest = history[0]?.w;
  const oldest = history[history.length - 1]?.w;
  const diff = latest != null && oldest != null ? latest - oldest : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Tracker</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Gewicht</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <Scale className="h-10 w-10 text-primary" />
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Aktuell</p>
            <p className="font-display text-4xl font-bold">{latest != null ? `${latest.toFixed(1)} kg` : "—"}</p>
            {diff != null && (
              <p className={`text-xs ${diff < 0 ? "text-primary" : "text-muted-foreground"}`}>
                {diff > 0 ? "+" : ""}{diff.toFixed(1)} kg seit Start
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <Input
            type="number" step="0.1" placeholder="z.B. 78,5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Button onClick={save} className="bg-gradient-gold text-primary-foreground">Eintragen</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">Verlauf</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Noch keine Einträge.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {history.map((h, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">{h.date}</span>
                <span className="font-display font-bold">{h.w.toFixed(1)} kg</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CoachingLockTeaser
        features={["Plateau-Warnung", "Foto-Check", "Individuelle Anpassung"]}
      />
    </div>
  );
}
