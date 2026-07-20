import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipForward, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/coach-tools/live")({
  head: () => ({ meta: [{ title: "Live-Kursmodus — Coach Tools" }] }),
  component: LivePage,
});

type Block = {
  phase: string;
  title: string;
  duration_seconds: number;
  timer_type: string;
  exercises?: { name: string; cue?: string; reps?: string; work_sec?: number; rest_sec?: number }[];
};

function LivePage() {
  const [template, setTemplate] = useState<any | null>(null);
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("coach-tools:live-template");
      if (raw) setTemplate(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const blocks: Block[] = template?.blocks ?? [];
  const cur = blocks[idx] as Block | undefined;
  const remaining = cur ? Math.max(0, cur.duration_seconds - elapsed) : 0;

  useEffect(() => {
    if (cur && running && elapsed >= cur.duration_seconds) {
      if (idx < blocks.length - 1) {
        setIdx((i) => i + 1);
        setElapsed(0);
      } else {
        setRunning(false);
      }
    }
  }, [elapsed, cur, running, idx, blocks.length]);

  if (!template) {
    return (
      <div className="space-y-4">
        <header>
          <div className="text-xs uppercase tracking-widest text-gold">Coach Tools</div>
          <h1 className="font-display text-2xl font-bold">Live-Kursmodus</h1>
        </header>
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Wähle in den <Link to="/coach-tools/templates" className="text-gold underline">Kursvorlagen</Link> eine Vorlage und starte sie live — oder nutze den <Link to="/coach-tools/timer" className="text-gold underline">Timer</Link> direkt.
        </div>
      </div>
    );
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gold">Block {idx + 1}/{blocks.length}</div>
          <div className="font-display text-xl font-bold">{template.name}</div>
        </div>
        <Link to="/coach-tools/templates" className="rounded-md p-2 hover:bg-secondary" aria-label="Schließen">
          <X className="h-5 w-5" />
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{cur?.phase}</div>
        <div className="font-display text-3xl font-bold sm:text-5xl">{cur?.title}</div>
        <div className="font-display text-[24vw] font-bold leading-none tabular-nums text-gold sm:text-[18vw]">
          {fmt(remaining)}
        </div>
        {cur?.exercises && cur.exercises.length > 0 && (
          <div className="max-w-2xl space-y-1 text-sm">
            {cur.exercises.map((e, i) => (
              <div key={i} className="flex justify-between gap-4 border-b border-border/40 py-1">
                <span>{e.name}</span>
                <span className="text-muted-foreground">
                  {e.work_sec ? `${e.work_sec}s${e.rest_sec ? ` / ${e.rest_sec}s` : ""}` : e.reps ?? ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={() => setRunning((r) => !r)} className={running ? "bg-amber-500 hover:bg-amber-600" : "bg-gradient-gold"}>
          {running ? <><Pause className="mr-2 h-4 w-4" /> Pause</> : <><Play className="mr-2 h-4 w-4" /> Start</>}
        </Button>
        <Button size="lg" variant="outline" onClick={() => { setElapsed(0); }}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset
        </Button>
        <Button size="lg" variant="outline" onClick={() => { setElapsed(0); setIdx((i) => Math.min(i + 1, blocks.length - 1)); }}>
          <SkipForward className="mr-2 h-4 w-4" /> Weiter
        </Button>
      </div>
    </div>
  );
}
