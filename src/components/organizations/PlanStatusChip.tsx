import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Info, ShieldCheck, TrendingUp, Waves } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listRecentReadinessGateEvents,
  type ReadinessGateEvent,
} from "@/lib/readiness-gate-events.functions";

/**
 * Athleten-Sicht auf die aktuelle Progressions-Phase.
 *
 * Der Athlet soll NICHT Confidence-Zahlen, Gate-Bezeichnungen oder Engine-
 * Events sehen — nur eine verständliche Zusammenfassung:
 *   1) Was macht der Plan gerade?
 *   2) Warum macht er das?
 *   3) Was kommt vermutlich als Nächstes?
 *
 * Datenbasis sind die Readiness-Gate-Events der letzten 14 Tage (SoT bleibt
 * unverändert: `training_progression_events`). Die eigentliche Confidence-
 * Cap-Logik läuft weiter in `stateFromDecision`.
 */
type Phase = "controlled" | "rebuilding" | "progressing";

function classify(events: ReadinessGateEvent[], now: Date): {
  phase: Phase;
  hardLast7: number;
  softLast7: number;
  hardLast14: number;
  lastHardDate: string | null;
} {
  const cutoff7 = now.getTime() - 7 * 86400000;
  const cutoff14 = now.getTime() - 14 * 86400000;
  let hardLast7 = 0;
  let softLast7 = 0;
  let hardLast14 = 0;
  let lastHardDate: string | null = null;
  for (const e of events) {
    const t = new Date(e.source_session_date + "T00:00:00Z").getTime();
    if (!Number.isFinite(t)) continue;
    if (t < cutoff14) continue;
    if (e.readiness_gate === "reduce") {
      hardLast14 += 1;
      if (t >= cutoff7) hardLast7 += 1;
      if (!lastHardDate || e.source_session_date > lastHardDate) lastHardDate = e.source_session_date;
    } else if (e.readiness_gate === "hold" && t >= cutoff7) {
      softLast7 += 1;
    }
  }
  let phase: Phase = "progressing";
  if (hardLast7 > 0) phase = "controlled";
  else if (hardLast14 > 0) phase = "rebuilding";
  return { phase, hardLast7, softLast7, hardLast14, lastHardDate };
}

const COPY: Record<Phase, {
  chip: string;
  headline: string;
  body: string;
  next: string;
  Icon: typeof ShieldCheck;
  tone: string;
  chipTone: string;
}> = {
  controlled: {
    chip: "Belastung kontrolliert",
    headline: "Belastung wird aktuell kontrolliert",
    body: "Dein Plan reagiert auf deine aktuelle Erholung und steigert die Belastung vorübergehend vorsichtiger.",
    next: "Sobald sich deine Werte über mehrere Tage stabilisieren, geht die Steigerung automatisch weiter.",
    Icon: ShieldCheck,
    tone: "border-orange-400/40 bg-orange-400/10 text-orange-100",
    chipTone: "border-orange-400/50 bg-orange-400/15 text-orange-100",
  },
  rebuilding: {
    chip: "Aufbauphase",
    headline: "Belastung wird schrittweise zurückgeführt",
    body: "Deine Werte haben sich verbessert. Wir erhöhen die Belastung kontrolliert und beobachten deine Reaktion.",
    next: "Wenn deine Erholung stabil bleibt, kehrt der Plan in den nächsten Tagen zur regulären Progression zurück.",
    Icon: Waves,
    tone: "border-sky-400/40 bg-sky-400/10 text-sky-100",
    chipTone: "border-sky-400/50 bg-sky-400/15 text-sky-100",
  },
  progressing: {
    chip: "Progression aktiv",
    headline: "Progression aktiv",
    body: "Deine bisherigen Trainingsdaten sprechen für eine reguläre Weiterentwicklung.",
    next: "Bleib bei den täglichen Check-ins — der Plan steigert Last und Volumen so, wie du es verträgst.",
    Icon: TrendingUp,
    tone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
    chipTone: "border-emerald-400/50 bg-emerald-400/15 text-emerald-100",
  },
};

export function PlanStatusChip({ userId }: { userId: string | undefined }) {
  const fetchEvents = useServerFn(listRecentReadinessGateEvents);
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["plan-status-chip", userId ?? "anon"],
    enabled: !!userId,
    queryFn: () => fetchEvents({ data: { userId: userId as string, days: 14 } }),
  });
  if (!userId) return null;
  const events = (data ?? []) as ReadinessGateEvent[];
  const info = classify(events, new Date());
  const copy = COPY[info.phase];
  const { Icon } = copy;

  const factors: string[] = [];
  if (info.hardLast7 > 0)
    factors.push(
      `Erholung: In den letzten 7 Tagen ${info.hardLast7}× deutlich eingeschränkt.`,
    );
  if (info.softLast7 > 0)
    factors.push(
      `Belastungstrend: ${info.softLast7}× wurde eine Steigerung bewusst pausiert.`,
    );
  if (info.phase === "rebuilding")
    factors.push("Aktuelle Werte haben sich gegenüber der letzten Woche verbessert.");
  if (info.phase === "progressing" && events.length === 0)
    factors.push("Deine letzten Check-ins zeigen ein stabiles Bild — keine roten Flaggen.");
  // Immer sichtbare, dynamische Erklärung: was der Plan grundsätzlich beobachtet.
  factors.push(
    "Dein Plan gewichtet zusätzlich: Beschwerden, Trainingsleistung, RPE/RIR und deine Progressionshistorie.",
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs ${copy.tone}`}
        aria-label="Warum sehe ich das?"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-90">
            {copy.chip}
          </div>
          <div className="truncate text-[13px] font-semibold leading-snug">
            {copy.headline}
          </div>
        </div>
        <Info className="h-3.5 w-3.5 opacity-70" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-4 w-4" /> {copy.headline}
            </DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Warum sehe ich das?
              </div>
              <ul className="mt-2 space-y-1.5">
                {factors.map((f, i) => (
                  <li key={i} className="flex gap-2 leading-snug">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Was passiert wahrscheinlich als Nächstes?
              </div>
              <p className="mt-1 leading-snug text-muted-foreground">{copy.next}</p>
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Hinweis: Das ist keine medizinische Diagnose. Bei anhaltenden Beschwerden
              sprich mit deinem Coach oder Medical-Ansprechpartner.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
