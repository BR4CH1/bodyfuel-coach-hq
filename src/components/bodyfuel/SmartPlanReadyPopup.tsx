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
} from "@/lib/plan-management.functions";
import { enqueueAutopilotJob, getMyAutopilotJob } from "@/lib/autopilot-jobs.functions";

/**
 * Zeigt Smart-Kunden, deren Ernährungs-Onboarding abgeschlossen ist,
 * aber noch keinen aktiven Ernährungsplan haben, ein One-Click-Popup
 * zur sofortigen Plan-Generierung & -Aktivierung.
 *
 * Sichtbarkeit:
 *  - smart_nutrition_profile.completed_at gesetzt
 *  - training_weekdays vorhanden
 *  - keinen aktiven Plan (auch kein draft/approved/published)
 *  - kein offener Autopilot-Job
 *  - pro Session dismissable (sessionStorage)
 */
export function SmartPlanReadyPopup({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMySmartProfile);
  const overviewFn = useServerFn(getCustomerPlanOverview);
  const enqueueFn = useServerFn(enqueueAutopilotJob);
  const jobFn = useServerFn(getMyAutopilotJob);

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

  const job = useQuery({
    queryKey: ["autopilot-job", userId],
    queryFn: () => jobFn(),
    enabled: !!userId && !dismissed,
  });

  const hasOpenJob =
    job.data?.status === "pending" || job.data?.status === "running";

  const shouldShow =
    !dismissed &&
    !!profile.data?.completed_at &&
    !!profile.data?.training_weekdays?.length &&
    !!overview.data &&
    !overview.data.active &&
    !overview.data.next &&
    !hasOpenJob;

  useEffect(() => {
    if (shouldShow) setOpen(true);
  }, [shouldShow]);

  const generate = useMutation({
    mutationFn: async () => {
      // Im Hintergrund über Queue + Cron statt synchron (Cloudflare-Timeout 524).
      return enqueueFn();
    },
    onSuccess: () => {
      toast.success("Plan wird im Hintergrund erstellt — du wirst informiert, sobald er bereit ist.");
      qc.invalidateQueries({ queryKey: ["autopilot-job", userId] });
      setOpen(false);
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Plan konnte nicht gestartet werden"),
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
