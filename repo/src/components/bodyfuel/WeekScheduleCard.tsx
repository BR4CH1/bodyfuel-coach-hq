import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dumbbell, Moon, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { getMySmartProfile } from "@/lib/smart-profile.functions";
import { getDayType, setDayType, type DayType } from "@/lib/nutrition.functions";
import {
  getBullsDailyNutritionTargets,
  setBullsDayType,
  ALL_BULLS_DAY_TYPES,
  BULLS_DAY_TYPE_LABELS,
  type BullsDayType,
} from "@/lib/performance-nutrition/bulls-nutrition.functions";
import { getMyTeamTrainingWeeks } from "@/lib/organizations/team-training-week.functions";
import { useSession } from "@/lib/bodyfuel/session";

const KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const LABELS_DE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type Variant = "personal" | "bulls";

export function WeekScheduleCard({
  userId,
  variant = "personal",
}: {
  userId: string;
  variant?: Variant;
}) {
  if (variant === "bulls") return <BullsWeekScheduleCard />;
  return <PersonalWeekScheduleCard userId={userId} />;
}

// ---------------------------------------------------------------------------
// Personal — unchanged behaviour (training/rest, personal nutrition context)
// ---------------------------------------------------------------------------
function PersonalWeekScheduleCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const getProfile = useServerFn(getMySmartProfile);
  const getDay = useServerFn(getDayType);
  const setDay = useServerFn(setDayType);
  const date = todayISO();
  const todayIdx = new Date().getDay();

  const { data: profile } = useQuery({
    queryKey: ["smart-profile-me"],
    queryFn: () => getProfile(),
  });

  const { data: today } = useQuery({
    queryKey: ["day-type", userId, date],
    queryFn: () => getDay({ data: { user_id: userId, date } }),
    enabled: !!userId,
  });

  const [busy, setBusy] = useState<DayType | null>(null);

  const trainSet = useMemo(
    () => new Set((profile?.training_weekdays ?? []).map((s) => s.toLowerCase())),
    [profile?.training_weekdays],
  );

  if (!profile?.training_weekdays?.length) return null;

  const flip = async (kind: DayType) => {
    setBusy(kind);
    try {
      await setDay({ data: { user_id: userId, date, kind } });
      await qc.invalidateQueries({ queryKey: ["day-type", userId, date] });
      toast.success(kind === "training" ? "Heute ist Trainingstag" : "Heute ist Restday");
    } catch (e: any) {
      toast.error(e?.message ?? "Konnte nicht speichern");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-gold">Deine Woche</div>
          <h2 className="font-display text-lg font-bold">Trainings- &amp; Restdays</h2>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {DISPLAY_ORDER.map((idx) => {
          const wkKey = KEYS[idx];
          const isToday = idx === todayIdx;
          const isTraining = isToday && today?.kind
            ? today.kind === "training"
            : trainSet.has(wkKey);
          return (
            <li
              key={wkKey}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                isToday ? "border-gold/60 bg-gold/10" : "border-border bg-background/40"
              }`}
            >
              <span className="font-medium">
                {LABELS_DE[idx]} {isToday && <span className="ml-1 text-[10px] uppercase tracking-wider text-gold">heute</span>}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  isTraining ? "text-gold" : "text-blue-300"
                }`}
              >
                {isTraining ? <Dumbbell className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {isTraining ? "Training Day" : "Restday"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
        <div className="text-xs text-muted-foreground">
          Heute eingestellt:{" "}
          <span className="font-semibold text-foreground">
            {today?.kind === "training" ? "Trainingstag" : "Restday"}
          </span>
          {today?.source === "manual" && (
            <span className="ml-1 text-[10px] uppercase tracking-wider text-gold">manuell</span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => flip("training")}
            disabled={busy !== null || today?.kind === "training"}
            className="flex items-center justify-center gap-2 rounded-lg border border-gold/50 bg-gradient-gold px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy === "training" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Dumbbell className="h-3.5 w-3.5" />}
            Heute trainiere ich doch
          </button>
          <button
            onClick={() => flip("rest")}
            disabled={busy !== null || today?.kind === "rest"}
            className="flex items-center justify-center gap-2 rounded-lg border border-blue-400/40 bg-blue-400/10 px-3 py-2 text-xs font-semibold text-blue-200 disabled:opacity-50"
          >
            {busy === "rest" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Moon className="h-3.5 w-3.5" />}
            Heute ist Restday
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulls — engine-driven 5-way day-type picker for today (org-scoped)
// ---------------------------------------------------------------------------
function BullsWeekScheduleCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getBullsDailyNutritionTargets);
  const setFn = useServerFn(setBullsDayType);
  const date = todayISO();

  const { data, isLoading } = useQuery({
    queryKey: ["bulls-nutrition-targets", date],
    queryFn: () => getFn({ data: { date } }),
  });

  const [busy, setBusy] = useState<BullsDayType | null>(null);

  if (isLoading || !data) return null;
  if (data.needsProfile) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-gold">Deine Woche</div>
        <h2 className="font-display text-lg font-bold">Day Type</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Ergänze dein Performance-Profil (Größe, Gewicht, Geschlecht, Alltagsaktivität,
          Ziel), damit deine Day Types berechnet werden können.
        </p>
      </div>
    );
  }

  const activeType: BullsDayType = data.dayType;

  const flip = async (kind: BullsDayType) => {
    setBusy(kind);
    try {
      await setFn({ data: { date, kind } });
      await qc.invalidateQueries({ queryKey: ["bulls-nutrition-targets", date] });
      await qc.invalidateQueries({ queryKey: ["bulls-nutrition-targets"] });
      toast.success(`Heute: ${BULLS_DAY_TYPE_LABELS[kind]}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Konnte nicht speichern");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <BullsMyTeamTrainingWeek />
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-gold">Heute</div>
            <h2 className="font-display text-lg font-bold">Day Type</h2>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Aktuell</div>
            <div className="text-sm font-bold text-gold">
              {BULLS_DAY_TYPE_LABELS[activeType]}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {data.dayTypeSource === "manual" ? "manuell" : "automatisch"}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ALL_BULLS_DAY_TYPES.map((k) => {
            const active = k === activeType;
            const kcal = data.perDayTypeTargets[k]?.kcal;
            return (
              <button
                key={k}
                onClick={() => flip(k)}
                disabled={busy !== null || active}
                className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left text-xs transition ${
                  active
                    ? "border-gold bg-gradient-to-br from-gold/20 to-transparent text-foreground"
                    : "border-border bg-background/40 hover:border-gold/60"
                } disabled:opacity-70`}
              >
                <span className="font-semibold">
                  {busy === k ? (
                    <Loader2 className="inline h-3 w-3 animate-spin" />
                  ) : null}{" "}
                  {BULLS_DAY_TYPE_LABELS[k]}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {kcal != null ? `${kcal} kcal` : "—"}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Kcal & Makros pro Day Type stammen aus deiner Performance Nutrition Engine.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulls — Team-Trainingswoche (aktuelle vs. kommende Woche, wenn veröffentlicht)
// ---------------------------------------------------------------------------
const WK_LABELS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function fmtShort(iso: string) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

function BullsMyTeamTrainingWeek() {
  const { supabaseUser } = useSession();
  const getWeeks = useServerFn(getMyTeamTrainingWeeks);
  const { data } = useQuery({
    queryKey: ["my-team-training-weeks", supabaseUser?.id ?? "anon"],
    queryFn: () => getWeeks({ data: {} }),
    enabled: !!supabaseUser,
  });
  const [view, setView] = useState<"current" | "upcoming">("current");

  const cur = data?.current ?? null;
  const up = data?.upcoming ?? null;
  const active = view === "upcoming" ? up : cur;

  // Nichts anzeigen wenn keine veröffentlichte Woche existiert.
  if (!cur && !up) return null;

  const sessions = active?.sessions ?? [];
  const weekStart = active?.week_start;
  const weekEnd = active?.week_end;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-bulls-red">
            <CalendarDays className="h-3.5 w-3.5" /> Team Training
          </div>
          <h3 className="mt-1 font-display text-lg font-bold">
            {weekStart && weekEnd ? `${fmtShort(weekStart)} – ${fmtShort(weekEnd)}` : "Wochenplan"}
          </h3>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-background/40 p-1">
          <button
            type="button"
            onClick={() => setView("current")}
            disabled={!cur}
            className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              view === "current" ? "bg-bulls-red text-white" : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-40`}
          >
            Aktuelle
          </button>
          <button
            type="button"
            onClick={() => setView("upcoming")}
            disabled={!up}
            className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              view === "upcoming" ? "bg-bulls-red text-white" : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-40`}
          >
            Kommende
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Kein Team Training in dieser Woche.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {sessions.map((s: any) => {
            const idx = (new Date(s.session_date + "T12:00:00Z").getUTCDay() + 6) % 7;
            return (
              <li
                key={s.session_date}
                className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-semibold">{WK_LABELS[idx]}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.title || "Team Training"}
                  </div>
                </div>
                <div className="text-right text-xs font-semibold text-gold">
                  {(s.start_time ?? "").slice(0, 5)}
                  {s.end_time ? ` – ${(s.end_time ?? "").slice(0, 5)}` : ""}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

