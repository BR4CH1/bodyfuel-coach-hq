import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { ACHIEVEMENTS } from "@/lib/bodyfuel/data";

export const Route = createFileRoute("/achievements")({
  head: () => ({ meta: [{ title: "Erfolge — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <AchievementsContent />
    </AppLayout>
  ),
});

function AchievementsContent() {
  const { user } = useSession();
  if (!user) return null;

  const results = ACHIEVEMENTS.map((a) => ({ a, r: a.check(user) }));
  const done = results.filter((x) => x.r.done).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Erfolge</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          {done} / {ACHIEVEMENTS.length} freigeschaltet
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map(({ a, r }) => {
          const pct = Math.round((r.progress / r.total) * 100);
          return (
            <div
              key={a.id}
              className={`relative overflow-hidden rounded-2xl border p-5 transition ${
                r.done
                  ? "border-gold/50 bg-card shadow-gold"
                  : "border-border bg-card opacity-90"
              }`}
            >
              {r.done && (
                <div className="absolute right-3 top-3 rounded-full bg-gradient-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  Erreicht
                </div>
              )}
              <div
                className={`grid h-16 w-16 place-items-center rounded-2xl text-3xl ${
                  r.done ? "bg-gradient-gold shadow-gold" : "bg-secondary"
                }`}
              >
                {r.done ? a.emoji : <Lock className="h-6 w-6 text-muted-foreground" />}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{a.name}</h3>
              <p className="text-xs text-muted-foreground">{a.description}</p>
              <div className="mt-4">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Fortschritt</span>
                  <span className="font-semibold">
                    {r.progress} / {r.total}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all ${
                      r.done ? "bg-gradient-gold" : "bg-muted-foreground/50"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
