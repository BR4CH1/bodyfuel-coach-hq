import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/coach-tools/timer")({
  head: () => ({ meta: [{ title: "Sporttimer — Coach Tools" }] }),
  component: TimerPage,
});

type Mode = "countdown" | "stopwatch" | "interval" | "tabata" | "emom" | "amrap";

const MODES: { key: Mode; label: string; desc: string }[] = [
  { key: "countdown", label: "Countdown", desc: "Runterzählen" },
  { key: "stopwatch", label: "Stoppuhr", desc: "Hochzählen" },
  { key: "interval", label: "Intervall", desc: "Work / Rest wechseln" },
  { key: "tabata", label: "Tabata", desc: "8 × 20/10 Sek" },
  { key: "emom", label: "EMOM", desc: "Alle 60 Sek Beep" },
  { key: "amrap", label: "AMRAP", desc: "So viele Runden wie möglich" },
];

function useBeep(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  return (freq = 880, ms = 180) => {
    if (!enabled) return;
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!ctxRef.current) ctxRef.current = new AC();
      const ctx = ctxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + ms / 1000);
    } catch {}
  };
}

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function TimerPage() {
  const [mode, setMode] = useState<Mode>("countdown");
  const [running, setRunning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sound, setSound] = useState(true);
  const beep = useBeep(sound);

  // params
  const [countdownSec, setCountdownSec] = useState(60);
  const [work, setWork] = useState(30);
  const [rest, setRest] = useState(15);
  const [rounds, setRounds] = useState(8);
  const [amrapMin, setAmrapMin] = useState(12);

  // state
  const [elapsed, setElapsed] = useState(0);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<"work" | "rest">("work");

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setRound(1);
    setPhase("work");
  };

  useEffect(() => reset(), [mode, countdownSec, work, rest, rounds, amrapMin]); // eslint-disable-line

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Phase computation
  let display = 0;
  let subtitle = "";
  let colorClass = "text-foreground";
  const totalRounds = mode === "tabata" ? 8 : rounds;

  if (mode === "countdown") {
    display = countdownSec - elapsed;
    subtitle = "Countdown";
    if (display <= 0) { if (running) { beep(1200, 400); setRunning(false); } display = 0; }
  } else if (mode === "stopwatch") {
    display = elapsed;
    subtitle = "Stoppuhr";
  } else if (mode === "interval" || mode === "tabata") {
    const w = mode === "tabata" ? 20 : work;
    const r = mode === "tabata" ? 10 : rest;
    const cycle = w + r;
    const total = cycle * totalRounds;
    if (elapsed >= total) {
      display = 0;
      subtitle = "Fertig!";
      if (running) { beep(1200, 500); setRunning(false); }
    } else {
      const pos = elapsed % cycle;
      const currentRound = Math.floor(elapsed / cycle) + 1;
      if (currentRound !== round) setRound(currentRound);
      if (pos < w) {
        display = w - pos;
        subtitle = `WORK · Runde ${currentRound}/${totalRounds}`;
        colorClass = "text-emerald-400";
        if (phase !== "work") { setPhase("work"); beep(880); }
      } else {
        display = w + r - pos;
        subtitle = `REST · Runde ${currentRound}/${totalRounds}`;
        colorClass = "text-amber-400";
        if (phase !== "rest") { setPhase("rest"); beep(440); }
      }
    }
  } else if (mode === "emom") {
    const total = 60 * rounds;
    if (elapsed >= total) { display = 0; subtitle = "Fertig!"; if (running) { beep(1200, 500); setRunning(false); } }
    else {
      const pos = elapsed % 60;
      display = 60 - pos;
      const currentRound = Math.floor(elapsed / 60) + 1;
      if (currentRound !== round) { setRound(currentRound); beep(880); }
      subtitle = `Minute ${currentRound}/${rounds}`;
    }
  } else if (mode === "amrap") {
    const total = amrapMin * 60;
    display = total - elapsed;
    subtitle = "AMRAP — so viele Runden wie möglich";
    if (display <= 0) { if (running) { beep(1200, 500); setRunning(false); } display = 0; }
  }

  const bigDisplay = mode === "stopwatch" ? fmt(display) : fmt(display);

  return (
    <div className={`${fullscreen ? "fixed inset-0 z-50 bg-background p-6 overflow-auto" : ""} space-y-6`}>
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">Coach Tools</div>
          <h1 className="font-display text-2xl font-bold">Sporttimer</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSound((s) => !s)} aria-label="Sound">
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={() => setFullscreen((f) => !f)}>
            {fullscreen ? "Fenster" : "Vollbild"}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              mode === m.key ? "border-gold bg-gold/15 text-gold" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-border bg-card/60 p-6 text-center backdrop-blur">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{subtitle}</div>
        <div className={`my-4 font-display font-bold tabular-nums ${fullscreen ? "text-[22vw] leading-none" : "text-[110px] leading-none"} ${colorClass}`}>
          {bigDisplay}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className={`min-w-[140px] ${running ? "bg-amber-500 hover:bg-amber-600" : "bg-gradient-gold"}`} onClick={() => setRunning((r) => !r)}>
            {running ? <><Pause className="mr-2 h-4 w-4" /> Pause</> : <><Play className="mr-2 h-4 w-4" /> Start</>}
          </Button>
          <Button size="lg" variant="outline" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      {!fullscreen && (
        <div className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {mode === "countdown" && (
              <FieldNum label="Sekunden" value={countdownSec} setValue={setCountdownSec} min={5} step={5} />
            )}
            {mode === "interval" && (
              <>
                <FieldNum label="Work (Sek)" value={work} setValue={setWork} min={5} />
                <FieldNum label="Rest (Sek)" value={rest} setValue={setRest} min={0} />
                <FieldNum label="Runden" value={rounds} setValue={setRounds} min={1} />
              </>
            )}
            {mode === "tabata" && (
              <FieldNum label="Runden" value={8} setValue={() => {}} min={8} />
            )}
            {mode === "emom" && (
              <FieldNum label="Minuten" value={rounds} setValue={setRounds} min={1} />
            )}
            {mode === "amrap" && (
              <FieldNum label="Minuten" value={amrapMin} setValue={setAmrapMin} min={1} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldNum({ label, value, setValue, min = 1, step = 1 }: { label: string; value: number; setValue: (n: number) => void; min?: number; step?: number }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => setValue(Math.max(min, Number(e.target.value) || min))}
        className="mt-1"
      />
    </div>
  );
}
