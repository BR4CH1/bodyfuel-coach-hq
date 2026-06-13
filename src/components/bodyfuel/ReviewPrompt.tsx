import { useEffect, useState } from "react";
import { Star, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";

const DISMISS_KEY = "bodyfuel.reviewPrompt.dismissed";

/**
 * Zählt aktive Nutzungstage über alle Tracking-Tabellen.
 * Aktiv = User hat an dem Tag mindestens einen Eintrag erzeugt.
 */
async function countActiveDays(userId: string): Promise<number> {
  const [checks, food, sets, water, meas] = await Promise.all([
    supabase.from("daily_checks").select("check_date").eq("user_id", userId),
    supabase.from("food_entries").select("created_at").eq("user_id", userId),
    supabase.from("training_set_logs").select("performed_at").eq("client_id", userId),
    supabase.from("water_logs").select("created_at").eq("user_id", userId),
    supabase.from("body_measurements").select("measured_at").eq("user_id", userId),
  ]);
  const days = new Set<string>();
  const add = (v: unknown) => {
    if (!v) return;
    const d = typeof v === "string" ? v : String(v);
    days.add(d.slice(0, 10));
  };
  checks.data?.forEach((r: any) => add(r.check_date));
  food.data?.forEach((r: any) => add(r.created_at));
  sets.data?.forEach((r: any) => add(r.performed_at));
  water.data?.forEach((r: any) => add(r.created_at));
  meas.data?.forEach((r: any) => add(r.measured_at));
  return days.size;
}

export function ReviewPrompt() {
  const { supabaseUser, profile, isCoach } = useSession();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabaseUser || isCoach) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    let cancelled = false;
    (async () => {
      // Bereits bewertet?
      const { data: existing } = await supabase
        .from("app_reviews")
        .select("id")
        .eq("user_id", supabaseUser.id)
        .maybeSingle();
      if (cancelled || existing) {
        if (existing) localStorage.setItem(DISMISS_KEY, "1");
        return;
      }
      const days = await countActiveDays(supabaseUser.id);
      if (cancelled) return;
      if (days >= 3) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseUser, isCoach]);

  const dismiss = (persist = true) => {
    setOpen(false);
    if (persist && typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
  };

  const submit = async () => {
    if (!supabaseUser) return;
    if (rating < 1) {
      toast.error("Bitte wähle mindestens einen Stern.");
      return;
    }
    setBusy(true);
    try {
      const firstName =
        (profile?.display_name ?? supabaseUser.email?.split("@")[0] ?? "")
          .trim()
          .split(/\s+/)[0] || null;
      const { error } = await supabase.from("app_reviews").upsert(
        {
          user_id: supabaseUser.id,
          rating,
          comment: comment.trim() || null,
          publish_with_name: publish,
          first_name: publish ? firstName : null,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      toast.success("Vielen Dank für deine Bewertung! 🙌");
      dismiss(true);
    } catch (err) {
      toast.error((err as Error).message || "Bewertung konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) dismiss(true);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gold/40 bg-gradient-to-b from-card via-card to-gold/5 sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3 w-3" /> Dein Feedback
          </div>
          <DialogTitle className="text-center font-display text-2xl">
            Wie gefällt dir BODYFUEL?
          </DialogTitle>
          <DialogDescription className="text-center">
            Du nutzt die App schon ein paar Tage — wir würden uns sehr über deine
            Bewertung freuen.
          </DialogDescription>
        </DialogHeader>

        {/* Stars */}
        <div className="flex justify-center gap-1.5 py-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= (hover || rating);
            return (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="rounded-md p-1 transition hover:scale-110"
                aria-label={`${n} Sterne`}
              >
                <Star
                  className={`h-9 w-9 ${
                    active ? "fill-gold text-gold" : "text-muted-foreground/40"
                  }`}
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
        </div>
        <div className="text-center text-xs text-muted-foreground">
          {rating > 0 ? `${rating} / 5 Sterne` : "Tippe auf einen Stern"}
        </div>

        <div className="mt-2 space-y-2">
          <Label htmlFor="review-comment" className="text-sm">
            Dein Kommentar (optional)
          </Label>
          <Textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Was gefällt dir besonders? Was können wir besser machen?"
          />
        </div>

        <label className="mt-2 flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3 cursor-pointer">
          <Checkbox
            checked={publish}
            onCheckedChange={(v) => setPublish(v === true)}
            className="mt-0.5"
          />
          <div className="text-sm">
            <div className="font-semibold">Veröffentlichung mit Vornamen erlauben</div>
            <div className="text-xs text-muted-foreground">
              Deine Bewertung darf mit deinem Vornamen auf der BODYFUEL-Website
              gezeigt werden.
            </div>
          </div>
        </label>

        <DialogFooter className="mt-2 flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={submit}
            disabled={busy || rating < 1}
            className="h-11 w-full bg-gradient-gold font-bold text-primary-foreground"
          >
            {busy ? "Wird gesendet …" : "Bewertung absenden"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => dismiss(true)}
            className="w-full text-muted-foreground"
          >
            Nicht jetzt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
