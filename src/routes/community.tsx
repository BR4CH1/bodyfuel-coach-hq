import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Shield, Flame, Sparkles, ChevronRight, Users, Award } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";

export const Route = createFileRoute("/community")({
  head: () => ({ meta: [{ title: "Community — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <CommunityHub />
    </AppLayout>
  ),
});

function CommunityHub() {
  const { profile, hasGroup } = useSession();
  const nickname = (profile as { nickname?: string | null } | null)?.nickname ?? null;

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-gold">Motivation & Wettbewerb</div>
        <h1 className="mt-1 font-display text-3xl font-bold">Community</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vergleich dich anonym mit anderen Athleten, freischalte Erfolge und sammle Punkte.
        </p>
      </header>

      {/* Community-Profil */}
      <section className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-gold">Dein Community-Profil</div>
            <div className="mt-1 font-display text-xl font-bold">
              {nickname ? nickname : "Noch kein Nickname"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              In Rankings erscheinst du ausschließlich mit deinem Nickname.
            </p>
          </div>
          <Link
            to="/ranking"
            className="rounded-lg bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            {nickname ? "Ranking ansehen" : "Nickname wählen"}
          </Link>
        </div>
      </section>

      {/* Hauptkacheln */}
      <section className="grid gap-3 sm:grid-cols-2">
        <HubLink
          to="/ranking"
          icon={<Trophy className="h-5 w-5" />}
          title="Ranking"
          description="Gesamt, Woche, Streak & Level"
          accent="gold"
        />
        <HubLink
          to="/achievements"
          icon={<Award className="h-5 w-5" />}
          title="Erfolge"
          description="Deine freigeschalteten Achievements"
          accent="emerald"
        />
        {hasGroup("bulls") && (
          <HubLink
            to="/dashboard"
            icon={<Shield className="h-5 w-5" />}
            title="Bulls Hub"
            description="Exklusiver Bereich für die Bulls"
            accent="rose"
          />
        )}
        {hasGroup("bulls") && (
          <HubLink
            to="/bulls/ranking"
            icon={<Trophy className="h-5 w-5" />}
            title="Bulls Rangliste"
            description="Konstanz, Planerfüllung & Entwicklung"
            accent="rose"
          />
        )}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-muted-foreground">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold">Challenges</div>
              <div className="text-xs text-muted-foreground">Tages-, Wochen- & Team-Challenges — bald verfügbar</div>
            </div>
          </div>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bald
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          Datenschutz
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Andere Athleten sehen dich ausschließlich mit deinem Nickname. Klarnamen werden niemals in
          Rankings angezeigt — nur dein Coach sieht beides.
        </p>
      </section>
    </div>
  );
}

function HubLink({
  to,
  icon,
  title,
  description,
  accent,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: "gold" | "emerald" | "rose";
}) {
  const accentMap = {
    gold: "bg-gold/15 text-gold",
    emerald: "bg-emerald-500/15 text-emerald-500",
    rose: "bg-rose-500/15 text-rose-500",
  };
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-gold/50"
    >
      <div className="flex items-center gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${accentMap[accent]}`}>{icon}</div>
        <div>
          <div className="text-sm font-bold">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}
