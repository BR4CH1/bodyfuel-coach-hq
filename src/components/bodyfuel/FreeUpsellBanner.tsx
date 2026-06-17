import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";

type Variant = "7d" | "30d" | "protein";

const COPY: Record<Variant, { title: string; body: string }> = {
  "7d": {
    title: "Du nutzt BodyFuel bereits seit 7 Tagen",
    body: "Lass dir jetzt kostenlos einen individuellen Ernährungsplan erstellen.",
  },
  "30d": {
    title: "Du trackst bereits wie ein Profi",
    body: "Der nächste Schritt: Dein persönlicher BodyFuel Coaching-Plan.",
  },
  protein: {
    title: "Dein Proteinziel ist oft knapp",
    body: "Mit einem individuellen Ernährungsplan erreichst du deine Ziele deutlich einfacher.",
  },
};

export function FreeUpsellBanner() {
  const { supabaseUser, isFreeUser } = useSession();
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    if (!supabaseUser || !isFreeUser) return;
    (async () => {
      const createdAt = supabaseUser.created_at ? new Date(supabaseUser.created_at) : null;
      const days = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86400000) : 0;

      // Dismissed banners
      const { data: dismissed } = await supabase
        .from("free_user_events")
        .select("event")
        .eq("user_id", supabaseUser.id)
        .like("event", "banner_dismissed_%");
      const dismissedSet = new Set((dismissed ?? []).map((d) => d.event));

      const pick = (v: Variant) => !dismissedSet.has(`banner_dismissed_${v}`);

      if (days >= 30 && pick("30d")) return setVariant("30d");

      // Check protein miss rate over last 14 days
      const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      const { data: checks } = await supabase
        .from("daily_checks")
        .select("tasks, check_date")
        .eq("user_id", supabaseUser.id)
        .gte("check_date", since);
      const list = checks ?? [];
      if (list.length >= 5) {
        const missed = list.filter((c: any) => !c.tasks?.protein).length;
        if (missed / list.length >= 0.5 && pick("protein")) return setVariant("protein");
      }

      if (days >= 7 && pick("7d")) return setVariant("7d");
    })();
  }, [supabaseUser, isFreeUser]);

  if (!variant) return null;
  const copy = COPY[variant];

  const dismiss = async () => {
    setVariant(null);
    if (!supabaseUser) return;
    await supabase.from("free_user_events").insert({
      user_id: supabaseUser.id,
      event: `banner_dismissed_${variant}`,
      details: { variant },
    });
  };

  const trackClick = async () => {
    if (!supabaseUser) return;
    await supabase.from("free_user_events").insert({
      user_id: supabaseUser.id,
      event: "upgrade_clicked",
      details: { variant, source: "banner" },
    });
  };

  return (
    <div className="mb-6 relative overflow-hidden rounded-2xl border border-primary/50 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-gold">
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Schließen"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-gold">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1 pr-6">
          <h3 className="font-display text-base font-bold sm:text-lg">{copy.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
          <Link
            to="/"
            onClick={trackClick}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Coaching entdecken
          </Link>
        </div>
      </div>
    </div>
  );
}
