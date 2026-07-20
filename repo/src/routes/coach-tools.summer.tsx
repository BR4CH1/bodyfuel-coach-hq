import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sun, Zap, Trophy, Shuffle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/coach-tools/summer")({
  head: () => ({ meta: [{ title: "Summer Mode — Coach Tools" }] }),
  component: SummerModePage,
});

const CHALLENGES = [
  { name: "100 Burpees", desc: "Auf Zeit — so schnell wie möglich", icon: Zap, timer: "stopwatch" },
  { name: "500 Squats", desc: "Teilaufgaben in Runden", icon: Zap, timer: "stopwatch" },
  { name: "5-Minuten Plank", desc: "Ohne Pause — halten!", icon: Sun, timer: "countdown", sec: 300 },
  { name: "Tabata Sprint", desc: "8× 20 Sek Vollgas, 10 Sek Pause", icon: Zap, timer: "tabata" },
  { name: "Team Battle", desc: "Zwei Teams — meiste Wiederholungen", icon: Trophy, timer: "countdown", sec: 180 },
  { name: "EMOM 12", desc: "12 Minuten · Jede Minute 10 Reps", icon: Zap, timer: "emom" },
  { name: "AMRAP 10", desc: "10 Minuten so viele Runden wie möglich", icon: Trophy, timer: "amrap" },
  { name: "Wall Sit 2:00", desc: "Statische Beinausdauer", icon: Sun, timer: "countdown", sec: 120 },
  { name: "Zufalls-Challenge", desc: "Überrasche deine Gruppe!", icon: Shuffle, timer: "stopwatch" },
];

function SummerModePage() {
  const [active, setActive] = useState<null | typeof CHALLENGES[number]>(null);

  const surprise = () => {
    const pool = CHALLENGES.filter((c) => c.name !== "Zufalls-Challenge");
    setActive(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">Coach Tools</div>
          <h1 className="font-display text-2xl font-bold">Summer Mode ☀️</h1>
          <p className="text-sm text-muted-foreground">Sofort startbare Challenges für Energie im Kurs.</p>
        </div>
        <Button onClick={surprise} variant="outline"><Shuffle className="mr-2 h-4 w-4" /> Zufall</Button>
      </header>

      {active && (
        <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-amber-500/20 to-rose-500/10 p-6">
          <div className="text-xs uppercase tracking-widest text-gold">Aktive Challenge</div>
          <div className="mt-1 font-display text-3xl font-bold">{active.name}</div>
          <div className="mt-1 text-sm text-muted-foreground">{active.desc}</div>
          <div className="mt-4 flex gap-2">
            <Link to="/coach-tools/timer" className="inline-flex items-center rounded-lg bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-foreground">
              <Play className="mr-2 h-4 w-4" /> Zum Timer
            </Link>
            <Link to="/coach-tools/live" className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm">
              Live-Modus
            </Link>
            <Button variant="ghost" onClick={() => setActive(null)}>Schließen</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CHALLENGES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.name}
              onClick={() => (c.name === "Zufalls-Challenge" ? surprise() : setActive(c))}
              className="rounded-2xl border border-border bg-card/60 p-5 text-left backdrop-blur transition hover:border-gold/60 hover:shadow-lg"
            >
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gold/15">
                <Icon className="h-5 w-5 text-gold" />
              </div>
              <div className="font-display text-lg font-bold">{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{c.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
