import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateCourse, type GeneratedCourse } from "@/lib/course-tools/generator.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/coach-tools/ai")({
  head: () => ({ meta: [{ title: "Kursgenerator — Coach Tools" }] }),
  component: AiGeneratorPage,
});

const PHASE_LABEL: Record<string, string> = {
  warmup: "Warm-up", main: "Hauptteil", finisher: "Finisher", cooldown: "Cool-down",
};

function AiGeneratorPage() {
  const gen = useServerFn(generateCourse);
  const { supabaseUser } = useSession();
  const [targetGroup, setTargetGroup] = useState("Erwachsene, gemischt, Anfänger bis Fortgeschritten");
  const [goal, setGoal] = useState("Ganzkörper-Fatburn");
  const [equipment, setEquipment] = useState("Matte, Kurzhanteln");
  const [duration, setDuration] = useState(45);
  const [intensity, setIntensity] = useState<"easy" | "medium" | "hard">("medium");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedCourse | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const r = await gen({ data: { target_group: targetGroup, goal, equipment, duration_minutes: duration, intensity } });
      setResult(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Generieren");
    } finally {
      setLoading(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!result || !supabaseUser) return;
    const { error } = await supabase.from("course_templates").insert({
      owner_id: supabaseUser.id,
      name: result.name,
      description: result.summary,
      duration_minutes: duration,
      target_group: targetGroup,
      equipment: equipment.split(",").map((s) => s.trim()).filter(Boolean),
      blocks: result.blocks as any,
    });
    if (error) return toast.error(error.message);
    toast.success("Als Vorlage gespeichert");
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-gold">Coach Tools</div>
        <h1 className="font-display text-2xl font-bold">KI-Kursgenerator</h1>
        <p className="text-sm text-muted-foreground">Beschreibe Zielgruppe & Ziel — die KI baut Warm-up, Hauptteil, Finisher und Cool-down.</p>
      </header>

      <div className="grid gap-4 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur md:grid-cols-2">
        <div><Label>Zielgruppe</Label><Textarea value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)} rows={2} /></div>
        <div><Label>Trainingsziel</Label><Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} /></div>
        <div><Label>Equipment</Label><Input value={equipment} onChange={(e) => setEquipment(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Dauer (Min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value) || 45)} /></div>
          <div>
            <Label>Intensität</Label>
            <select value={intensity} onChange={(e) => setIntensity(e.target.value as any)} className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm">
              <option value="easy">Leicht</option>
              <option value="medium">Mittel</option>
              <option value="hard">Hart</option>
            </select>
          </div>
        </div>
        <div className="md:col-span-2">
          <Button onClick={run} disabled={loading} className="bg-gradient-gold">
            <Sparkles className="mr-2 h-4 w-4" /> {loading ? "Generiere…" : "Kurs generieren"}
          </Button>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gold/40 bg-card/60 p-5 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-display text-2xl font-bold">{result.name}</div>
                <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveAsTemplate} variant="outline"><Save className="mr-2 h-4 w-4" /> Als Vorlage speichern</Button>
                <Link to="/coach-tools/live" className="inline-flex items-center rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-foreground">
                  Live starten
                </Link>
              </div>
            </div>
          </div>
          {result.blocks.map((b, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card/40 p-5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-gold">{PHASE_LABEL[b.phase] ?? b.phase}</div>
                  <div className="font-display text-lg font-bold">{b.title}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(b.duration_seconds / 60)} min · {b.timer_type}
                </div>
              </div>
              <ul className="space-y-1 text-sm">
                {b.exercises.map((e, j) => (
                  <li key={j} className="flex justify-between gap-2 border-b border-border/40 py-1.5 last:border-0">
                    <span>{e.name}{e.cue ? <span className="ml-2 text-xs italic text-muted-foreground">– {e.cue}</span> : null}</span>
                    <span className="text-xs text-muted-foreground">
                      {e.work_sec ? `${e.work_sec}s${e.rest_sec ? ` / ${e.rest_sec}s` : ""}` : e.reps ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
              {b.notes && <p className="mt-2 text-xs italic text-muted-foreground">💡 {b.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
