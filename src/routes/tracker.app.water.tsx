import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Droplet, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tracker/app/water")({
  head: () => ({ meta: [{ title: "Wasser — BodyFuel Tracker" }] }),
  component: WaterPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function WaterPage() {
  const { supabaseUser } = useSession();
  const [glasses, setGlasses] = useState(0);
  const [goal, setGoal] = useState(8);
  const [history, setHistory] = useState<{ date: string; glasses: number }[]>([]);

  const load = async () => {
    if (!supabaseUser) return;
    const [{ data: t }, { data: h }] = await Promise.all([
      supabase.from("nutrition_targets").select("water_glasses").eq("user_id", supabaseUser.id).maybeSingle(),
      supabase
        .from("water_logs")
        .select("entry_date, glasses")
        .eq("user_id", supabaseUser.id)
        .order("entry_date", { ascending: false })
        .limit(14),
    ]);
    if (t?.water_glasses) setGoal(t.water_glasses);
    const rows = (h ?? []) as { entry_date: string; glasses: number }[];
    setHistory(rows.map((r) => ({ date: r.entry_date, glasses: r.glasses })));
    const todayRow = rows.find((r) => r.entry_date === today());
    setGlasses(todayRow?.glasses ?? 0);
  };

  useEffect(() => { load(); }, [supabaseUser]);

  const save = async (next: number) => {
    if (!supabaseUser) return;
    const v = Math.max(0, Math.min(40, next));
    setGlasses(v);
    const { error } = await supabase
      .from("water_logs")
      .upsert(
        { user_id: supabaseUser.id, entry_date: today(), glasses: v },
        { onConflict: "user_id,entry_date" },
      );
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const pct = Math.min(100, Math.round((glasses / Math.max(1, goal)) * 100));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Tracker</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Wasser</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <Droplet className="h-10 w-10 text-primary" />
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Heute</p>
            <p className="font-display text-4xl font-bold">{glasses} <span className="text-lg text-muted-foreground">/ {goal} Gläser</span></p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-gradient-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" onClick={() => save(glasses - 1)} aria-label="Weniger">
            <Minus className="h-5 w-5" />
          </Button>
          <Button onClick={() => save(glasses + 1)} className="h-14 px-8 text-base">
            <Plus className="mr-2 h-5 w-5" /> Glas (250 ml)
          </Button>
          <Button variant="outline" size="icon" onClick={() => save(glasses + 4)} aria-label="+1 L">
            <span className="text-xs font-bold">+1L</span>
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-3 font-display text-lg font-bold">Letzte 14 Tage</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((r) => (
              <li key={r.date} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">{new Date(r.date).toLocaleDateString("de-DE")}</span>
                <span className="font-semibold">{r.glasses} Gläser</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
