import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import {
  Timer,
  BookOpen,
  Sun,
  Sparkles,
  ClipboardList,
  Play,
  Music4,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/coach-tools/")({
  head: () => ({ meta: [{ title: "Coach Tools — BODYFUEL" }] }),
  component: CoachToolsHub,
});

const tiles = [
  { to: "/coach-tools/timer", label: "Sporttimer", desc: "Countdown, Intervall, Tabata, EMOM, AMRAP", icon: Timer, tone: "from-amber-500/20 to-amber-500/5" },
  { to: "/coach-tools/live", label: "Live-Kursmodus", desc: "Vollbild-Ansicht während des Kurses", icon: Play, tone: "from-rose-500/20 to-rose-500/5" },
  { to: "/coach-tools/ai", label: "Kursgenerator", desc: "KI erstellt komplette Kursstunden", icon: Sparkles, tone: "from-violet-500/20 to-violet-500/5" },
  { to: "/coach-tools/templates", label: "Kursvorlagen", desc: "Eigene Stunden speichern & wiederverwenden", icon: ClipboardList, tone: "from-emerald-500/20 to-emerald-500/5" },
  { to: "/coach-tools/exercises", label: "Übungsbibliothek", desc: "Übungen mit Cues & Medien", icon: BookOpen, tone: "from-sky-500/20 to-sky-500/5" },
  { to: "/coach-tools/summer", label: "Summer Mode", desc: "Sofortige Challenges & Team Battles", icon: Sun, tone: "from-orange-500/20 to-orange-500/5" },
  { to: "/coach-tools/music", label: "Musik & Playlists", desc: "Spotify · Apple Music · YouTube", icon: Music4, tone: "from-fuchsia-500/20 to-fuchsia-500/5" },
  { to: "/coach-tools/participants", label: "Teilnehmerliste", desc: "Anwesenheit & Notizen", icon: Users, tone: "from-cyan-500/20 to-cyan-500/5" },
];

function CoachToolsHub() {
  const { supabaseUser, profile, loading } = useSession();
  const navigate = useNavigate();
  const uid = supabaseUser?.id;
  const { data: allowed, isLoading: gateLoading } = useQuery({
    queryKey: ["coach-tools-instructor-enabled", uid],
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_memberships")
        .select("organization_id")
        .eq("user_id", uid!)
        .eq("status", "active")
        .eq("is_course_instructor", true)
        .limit(1);
      if (error) return false;
      return (data ?? []).length > 0;
    },
  });


  useEffect(() => {
    if (!loading && !gateLoading && profile && allowed === false) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, gateLoading, profile, allowed, navigate]);

  if (loading || gateLoading || !profile) return null;
  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-xs uppercase tracking-widest text-gold">Coach Tools</div>
        <h1 className="font-display text-3xl font-bold">Werkzeuge für den Kurs</h1>
        <p className="text-sm text-muted-foreground">
          Timer, Übungen, KI-Generator und Live-Modus — optimiert für den laufenden Unterricht.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${t.tone} p-5 transition hover:border-gold/60 hover:shadow-lg`}
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-background/70 backdrop-blur">
                <Icon className="h-5 w-5 text-gold" />
              </div>
              <div className="font-display text-lg font-bold">{t.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t.desc}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
