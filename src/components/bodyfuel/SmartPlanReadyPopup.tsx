import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMySmartProfile } from "@/lib/smart-profile.functions";
import {
  getCustomerPlanOverview,
  transitionPlanStatus,
} from "@/lib/plan-management.functions";
import { generateAiNutritionPlanDraft } from "@/lib/nutrition-plan-ai.functions";

/**
 * Zeigt Smart-Kunden, deren Ernährungs-Onboarding abgeschlossen ist,
 * aber noch keinen aktiven Ernährungsplan haben, ein One-Click-Popup
 * zur sofortigen Plan-Generierung & -Aktivierung.
 *
 * Sichtbarkeit:
 *  - smart_nutrition_profile.completed_at gesetzt
 *  - training_weekdays vorhanden
 *  - keinen aktiven Plan (auch kein draft/approved/published)
 *  - pro Session dismissable (sessionStorage)
 */
export function SmartPlanReadyPopup({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMySmartProfile);
  const overviewFn = useServerFn(getCustomerPlanOverview);
  const genFn = useServerFn(generateAiNutritionPlanDraft);
  const transFn = useServerFn(transitionPlanStatus);

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(`smart-plan-popup-dismissed:${userId}`) === "1") {
        setDismissed(true);
      }
    } catch {}
  }, [userId]);

  const profile = useQuery({
    queryKey: ["smart-profile-me", userId],
    queryFn: () => profileFn(),
    enabled: !!userId && !dismissed,
  });

  const overview = useQuery({
    queryKey: ["plan-overview", userId],
    queryFn: () => overviewFn({ data: { user_id: userId } }),
    enabled:
      !!userId &&
      !dismissed &&
      !!profile.data?.completed_at &&
      !!profile.data?.training_weekdays?.length,
  });

  const shouldShow =
    !dismissed &&
    !!profile.data?.completed_at &&
    !!profile.data?.training_weekdays?.length &&
    !!overview.data &&
    !overview.data.active &&
    !overview.data.next;

  useEffect(() => {
    if (shouldShow) setOpen(true);
  }, [shouldShow]);

  const generate = useMutation({
    mutationFn: async () => {
      const draft = await genFn({
        data: { user_id: userId, start_mode: "today" },
      });
      const planId = (draft as any)?.plan_id ?? (draft as any)?.id;
      if (planId) {
        try {
          await transFn({ data: { plan_id: planId, to: "active" } });
        } catch (e) {
          // Falls Aktivierung fehlschlägt, liegt der Entwurf trotzdem bereit.
          console.warn("auto-activate failed", e);
        }
      }
      return draft;
    },
    onSuccess: () => {
      toast.success("Dein Smart-Ernährungsplan ist startklar!");
      qc.invalidateQueries({ queryKey: ["plan-overview", userId] });
      qc.invalidateQueries({ queryKey: ["plan-content"] });
      qc.invalidateQueries({ queryKey: ["nutrition-targets"] });
      setOpen(false);
      navigate({ to: "/nutrition" });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Plan konnte nicht erstellt werden"),
  });

  const dismiss = () => {
    try {
      sessionStorage.setItem(`smart-plan-popup-dismissed:${userId}`, "1");
    } catch {}
    setDismissed(true);
    setOpen(false);
  };

  if (!shouldShow) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? dismiss() : setOpen(true))}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-gradient-gold text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">
            Dein Smart-Plan ist bereit ✨
          </DialogTitle>
          <DialogDescription className="text-center">
            Wir haben alle deine Vorlieben — jetzt nur noch ein Klick und dein
            persönlicher Ernährungsplan ist startklar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="w-full bg-gradient-gold text-primary-foreground"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {generate.isPending ? "Erstelle Plan…" : "Plan jetzt erstellen"}
          </Button>
          <Button
            variant="ghost"
            onClick={dismiss}
            disabled={generate.isPending}
            className="w-full"
          >
            <X className="mr-2 h-4 w-4" /> Später
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
