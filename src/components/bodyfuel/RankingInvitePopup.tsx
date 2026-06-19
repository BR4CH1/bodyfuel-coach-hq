import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Trophy, Flame, Users, Sparkles, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyNickname } from "@/lib/ranking.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "bf_ranking_invite_dismissed_at";
const COOLDOWN_DAYS = 5;

export function RankingInvitePopup() {
  const nickFn = useServerFn(getMyNickname);
  const { data, isLoading } = useQuery({
    queryKey: ["my-nickname"],
    queryFn: () => nickFn(),
  });

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (data?.nickname) return;
    if (typeof window === "undefined") return;
    const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const days = (Date.now() - Number(dismissedAt)) / 86400000;
      if (days < COOLDOWN_DAYS) return;
    }
    const t = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(t);
  }, [data, isLoading]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setOpen(false);
  };

  if (data?.nickname) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-md overflow-hidden border-gold/40 p-0">
        <div className="relative bg-gradient-to-br from-gold/20 via-gold/5 to-transparent p-6">
          <button
            onClick={dismiss}
            className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-background/60 hover:text-foreground"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3.5 w-3.5" />
            Neu
          </div>
          <DialogHeader className="mt-2">
            <DialogTitle className="font-display text-2xl">
              Ranking jetzt verfügbar 🏆
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Miss dich anonym mit der gesamten BODYFUEL Community —
              wer holt die meisten Punkte, hält die längste Streak und steht
              ganz oben?
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 pb-6">
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
                <Trophy className="h-4 w-4" />
              </span>
              <span>
                <strong>Hol dir Platz #1</strong> — wer trackt, gewinnt.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
                <Flame className="h-4 w-4" />
              </span>
              <span>
                <strong>Streaks & Wochenpunkte</strong> live im Vergleich.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
                <Users className="h-4 w-4" />
              </span>
              <span>
                <strong>100% anonym</strong> — du erscheinst nur mit deinem Nickname.
              </span>
            </li>
          </ul>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Link
              to="/ranking"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              <Button className="w-full bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
                Jetzt teilnehmen
              </Button>
            </Link>
            <Button variant="ghost" onClick={dismiss} className="sm:w-auto">
              Später
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
