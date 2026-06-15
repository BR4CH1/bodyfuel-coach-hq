import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ArrowRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMyAthleteProfile } from "@/lib/athlete-profile.functions";

const STORAGE_KEY = "bf:sport-weekdays-prompt:dismissed";

export function SportWeekdaysPrompt() {
  const getFn = useServerFn(getMyAthleteProfile);
  const { data } = useQuery({
    queryKey: ["my-athlete-profile"],
    queryFn: () => getFn(),
  });

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!data) return;

    const hasSportActivity =
      Boolean(data.sport?.trim()) ||
      Boolean(data.team_sport) ||
      (data.class_types && data.class_types.length > 0);

    const hasWeekdays =
      Array.isArray(data.sport_weekdays) && data.sport_weekdays.length > 0;

    const dismissed = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        return false;
      }
    })();

    if (hasSportActivity && !hasWeekdays && !dismissed) {
      setOpen(true);
    }
  }, [data]);

  const handleDismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gold/40 bg-gradient-to-b from-card via-card to-gold/5 sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            <CalendarDays className="h-3 w-3" /> Trainingstage fehlen
          </div>
          <DialogTitle className="text-center font-display text-2xl">
            Wann ist dein Sport / Training?
          </DialogTitle>
          <DialogDescription className="text-center">
            Du hast schon deine Sportart eingetragen — super! Damit die KI
            Übertraining vermeidet, braucht sie noch die Wochentage.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-center">
          <p className="text-sm">
            An Tagen mit Mannschaftstraining, Kursen oder Sport plant die KI
            automatisch leichteres Beintraining oder pusht es auf andere Tage.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            asChild
            className="h-11 w-full bg-gradient-gold font-bold text-primary-foreground"
            onClick={() => setOpen(false)}
          >
            <Link to="/profile" hash="athlete-profile">
              Jetzt ergänzen <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleDismiss}
          >
            <X className="mr-1 h-4 w-4" /> Später erinnern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
