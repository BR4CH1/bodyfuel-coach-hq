import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Flame, Star, Sparkles, Crown, Medal, Check, Lock } from "lucide-react";
import { getLevel } from "@/lib/bodyfuel/data";

type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  trigger_type: string;
  threshold: number;
  reward_points: number;
  sort_order: number;
};

type UserPoints = {
  total_points: number;
  level: number;
  current_streak: number;
  longest_streak: number;
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  flame: Flame,
  star: Star,
  sparkles: Sparkles,
  crown: Crown,
  medal: Medal,
  check: Check,
};

function IconFor({ name, className }: { name: string; className?: string }) {
  const Cmp = ICON_MAP[name] ?? Trophy;
  return <Cmp className={className} />;
}

export function AchievementsCard({ userId }: { userId: string }) {
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [all, setAll] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: pts }, { data: achs }, { data: ua }] = await Promise.all([
        supabase
          .from("user_points")
          .select("total_points, level, current_streak, longest_streak")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.from("achievements").select("*").order("sort_order"),
        supabase.from("user_achievements").select("achievement_id").eq("user_id", userId),
      ]);
      setPoints(
        pts ?? { total_points: 0, level: 1, current_streak: 0, longest_streak: 0 },
      );
      setAll((achs ?? []) as Achievement[]);
      setUnlocked(new Set((ua ?? []).map((r) => r.achievement_id)));
      setLoading(false);
    })();
  }, [userId]);

  const total = points?.total_points ?? 0;
  const rank = getLevel(total);
  const rankName = rank.level.name;
  const nextName = rank.next?.name;
  const pointsToNext = rank.next ? rank.next.min - total : 0;
  const levelProgress = rank.progress;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Lade Erfolge…
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-gold">
            <Trophy className="h-5 w-5" />
            <span className="text-xs uppercase tracking-wider">Level & Erfolge</span>
          </div>
          <h2 className="mt-1 font-display text-xl font-bold">
            {rankName}
          </h2>
          <p className="text-xs text-muted-foreground">
            {total} Punkte gesamt{nextName ? ` · noch ${pointsToNext} bis ${nextName}` : " · Maximaler Rang erreicht"}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1 text-gold">
            <Flame className="h-4 w-4" />
            <span className="font-display text-lg font-bold">
              {points?.current_streak ?? 0}
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Tage-Streak
          </p>
          <p className="text-[10px] text-muted-foreground">
            Best: {points?.longest_streak ?? 0}
          </p>
        </div>
      </div>

      {/* Level Progress */}
      <div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-gold transition-all"
            style={{ width: `${levelProgress}%` }}
          />
        </div>
      </div>

      {/* Achievements Grid */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="uppercase tracking-wider text-muted-foreground">
            Erfolge
          </span>
          <span className="text-muted-foreground">
            {unlocked.size} / {all.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {all.map((a) => {
            const isUnlocked = unlocked.has(a.id);
            return (
              <div
                key={a.id}
                title={`${a.title} — ${a.description}`}
                className={`group flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition ${
                  isUnlocked
                    ? "border-gold/40 bg-gradient-to-br from-gold/15 to-transparent"
                    : "border-border bg-muted/30 opacity-60"
                }`}
              >
                <div
                  className={`grid h-10 w-10 place-items-center rounded-lg ${
                    isUnlocked
                      ? "bg-gradient-gold text-primary-foreground shadow-gold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isUnlocked ? (
                    <IconFor name={a.icon} className="h-5 w-5" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                </div>
                <div className="text-[10px] font-semibold leading-tight">
                  {a.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
