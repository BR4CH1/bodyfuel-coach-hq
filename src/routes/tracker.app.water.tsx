import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Droplet, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tracker/app/water")({
  head: () => ({ meta: [{ title: "Wasser — BodyFuel Tracker" }] }),
  component: WaterPage,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function WaterPage() {
  const { supabaseUser } = useSession();
  const [glasses, setGlasses] = useState(0);
  const [target, setTarget] = useState(8);

  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      const { data } = await supabase
        .from("water_logs")
        .select("glasses")
        .eq("user_id", supabaseUser.id)
        .eq("entry_date", today())
        .maybeSingle();
      if (data) setGlasses(data.glasses ?? 0);
      const storedTarget = Number(localStorage.getItem("tracker:waterTarget") || "8");
      if (storedTarget > 0) setTarget(storedTarget);
    })();
  }, [supabaseUser]);

  const save = async (newGlasses: number, newTarget = target) => {
    if (!supabaseUser) return;
    const g = Math.max(0, newGlasses);
    setGlasses(g);
    setTarget(newTarget);
    localStorage.setItem("tracker:waterTarget", String(newTarget));
    const { error } = await supabase.from("water_logs").upsert(
      {
        user_id: supabaseUser.id,
        entry_date: today(),
        glasses: g,
      },
      { onConflict: "user_id,entry_date" },
    );
    if (error) toast.error(error.message);
  };

  const pct = Math.min(100, Math.round((glasses / Math.max(1, target)) * 100));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Heute</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Wasser tracken</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Heute</p>
            <p className="mt-1 flex items-baseline gap-2 font-display text-4xl font-bold">
              {glasses} <span className="text-lg text-muted-foreground">/ {target} Gläser</span>
            </p>
          </div>
          <Droplet className="h-10 w-10 text-primary" />
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-gradient-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => save(glasses - 1)}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button onClick={() => save(glasses + 1)} className="flex-1 bg-gradient-gold text-primary-foreground">
            <Plus className="mr-1 h-4 w-4" /> Glas hinzufügen
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Tagesziel</label>
        <div className="mt-2 flex items-center gap-2">
          {[6, 8, 10, 12].map((t) => (
            <button
              key={t}
              onClick={() => { setTarget(t); save(glasses, t); }}
              className={
                "rounded-full border px-4 py-2 text-sm font-semibold " +
                (target === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
