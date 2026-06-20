import { createFileRoute, Link } from "@tanstack/react-router";
import { Apple, Scale, Dumbbell, ArrowRight, Droplet, Footprints, User } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { DailyChecklist } from "@/components/bodyfuel/DailyChecklist";
import { AchievementsCard } from "@/components/bodyfuel/AchievementsCard";
import { CoachingLockTeaser } from "@/components/bodyfuel/CoachingLockTeaser";
import { RankingInvitePopup } from "@/components/bodyfuel/RankingInvitePopup";
import { MyPackagePanel } from "@/components/bodyfuel/MyPackagePanel";

export const Route = createFileRoute("/tracker/app/")({
  head: () => ({ meta: [{ title: "Heute — BodyFuel Tracker" }] }),
  component: TrackerHome,
});

function TrackerHome() {
  const { supabaseUser, profile } = useSession();
  if (!supabaseUser) return null;
  const name = profile?.display_name?.split(" ")[0] ?? "Athlet";

  const tiles = [
    { to: "/tracker/app/nutrition", label: "Ernährung", icon: Apple, desc: "Kalorien & Makros" },
    { to: "/tracker/app/training", label: "Training", icon: Dumbbell, desc: "Plan & Tracking" },
    { to: "/tracker/app/weight", label: "Gewicht", icon: Scale, desc: "Verlauf" },
    { to: "/tracker/app/water", label: "Wasser", icon: Droplet, desc: "Gläser pro Tag" },
    { to: "/tracker/app/activity", label: "Aktivität", icon: Footprints, desc: "Schritte & Training" },
    { to: "/tracker/app/profile", label: "Profil", icon: User, desc: "Einstellungen" },
  ] as const;

  return (
    <div className="space-y-6">
      <RankingInvitePopup />
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Heute</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Hi {name} 👋</h1>
      </div>

      <DailyChecklist userId={supabaseUser.id} hideCheckin />

      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50"
            >
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-gold">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-display text-lg font-bold">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
            </Link>
          );
        })}
      </div>

      <CoachingLockTeaser
        features={[
          "Individueller Trainingsplan",
          "Persönlicher Ernährungsplan",
          "Foto-Assessment",
          "Coach-Chat",
        ]}
      />

      <AchievementsCard userId={supabaseUser.id} />
    </div>
  );
}
