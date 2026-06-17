import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Flame, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";

export const Route = createFileRoute("/tracker/app/achievements")({
  head: () => ({ meta: [{ title: "Erfolge — BodyFuel Tracker" }] }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const { supabaseUser } = useSession();
  const [points, setPoints] = useState<{ total: number; level: number; streak: number; longest: number } | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [all, setAll] = useState<any[]>([]);

  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      const [{ data: up }, { data: ua }, { data: ach }] = await Promise.all([
        supabase
          .from("user_points")
          .select("total_points, level, current_streak, longest_streak")
          .eq("user_id", supabaseUser.id)
          .maybeSingle(),
        supabase.from("user_achievements").select("achievement_id").eq("user_id", supabaseUser.id),
        supabase.from("achievements").select("id, code, title, description, icon").order("sort_order"),
      ]);
      setPoints({
        total: up?.total_points ?? 0,
        level: up?.level ?? 1,
        streak: up?.current_streak ?? 0,
        longest: up?.longest_streak ?? 0,
      });
      setUnlocked(new Set((ua ?? []).map((r: any) => r.achievement_id)));
      setAll(ach ?? []);
    })();
  }, [supabaseUser]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Erfolge</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Deine Achievements</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Level" value={points?.level ?? 1} icon={<Star className="h-5 w-5" />} />
        <Stat label="XP" value={points?.total ?? 0} icon={<Trophy className="h-5 w-5" />} />
        <Stat label="Streak" value={points?.streak ?? 0} icon={<Flame className="h-5 w-5" />} />
        <Stat label="Bestleistung" value={points?.longest ?? 0} icon={<Flame className="h-5 w-5" />} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((a) => {
          const done = unlocked.has(a.id);
          return (
            <div
              key={a.id}
              className={
                "rounded-2xl border p-5 transition " +
                (done ? "border-primary/60 bg-primary/10" : "border-border bg-card opacity-70")
              }
            >
              <div className="text-2xl">{a.icon ?? "🏆"}</div>
              <h3 className="mt-2 font-display text-base font-bold">{a.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
              <p className={"mt-3 text-[11px] font-bold uppercase tracking-wider " + (done ? "text-primary" : "text-muted-foreground")}>
                {done ? "Freigeschaltet" : "Noch nicht erreicht"}
              </p>
            </div>
          );
        })}
        {all.length === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Achievements verfügbar.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}
