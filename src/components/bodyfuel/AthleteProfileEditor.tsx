import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save, Dumbbell, Trophy } from "lucide-react";
import {
  updateMyAthleteProfile,
  updateCustomerAthleteProfile,
  type AthleteProfileInput,
} from "@/lib/athlete-profile.functions";

type Experience = "beginner" | "intermediate" | "advanced";
type SportLevel = "recreational" | "amateur" | "semi_pro" | "pro" | "coach";
type SeasonPhase = "off_season" | "pre_season" | "in_season" | "post_season";
type MobilityFreq = "none" | "1_2x" | "3_4x" | "daily";

const SPORT_LEVELS: { v: SportLevel; l: string }[] = [
  { v: "recreational", l: "Hobby" },
  { v: "amateur", l: "Amateur" },
  { v: "semi_pro", l: "Semi-Pro" },
  { v: "pro", l: "Profi" },
  { v: "coach", l: "Trainer/Kursleiter" },
];
const SEASON: { v: SeasonPhase; l: string }[] = [
  { v: "off_season", l: "Off-Season" },
  { v: "pre_season", l: "Vorbereitung" },
  { v: "in_season", l: "Saison" },
  { v: "post_season", l: "Nachsaison" },
];
const MOBILITY: { v: MobilityFreq; l: string }[] = [
  { v: "none", l: "Nie" },
  { v: "1_2x", l: "1–2× Wo" },
  { v: "3_4x", l: "3–4× Wo" },
  { v: "daily", l: "Täglich" },
];
const CLASS_PRESETS = ["Yoga", "Pilates", "Spinning", "HIIT", "Bodypump", "CrossFit", "Boxen", "Functional"];
const WEEKDAYS: { v: string; l: string }[] = [
  { v: "monday", l: "Mo" },
  { v: "tuesday", l: "Di" },
  { v: "wednesday", l: "Mi" },
  { v: "thursday", l: "Do" },
  { v: "friday", l: "Fr" },
  { v: "saturday", l: "Sa" },
  { v: "sunday", l: "So" },
];

export type AthleteProfileInitial = AthleteProfileInput & {
  sport?: string | null;
  sport_weekdays?: string[] | null;
  training_experience?: Experience | null;
};

export function AthleteProfileEditor({
  userId,
  mode = "coach",
  initial,
  onSaved,
}: {
  userId?: string; // required when mode="coach"
  mode?: "coach" | "self";
  initial: AthleteProfileInitial;
  onSaved?: () => void;
}) {
  const [sport, setSport] = useState(initial.sport ?? "");
  const [sportPosition, setSportPosition] = useState(initial.sport_position ?? "");
  const [sportLevel, setSportLevel] = useState<SportLevel | "">(
    (initial.sport_level as SportLevel) ?? "",
  );
  const [teamSport, setTeamSport] = useState<boolean>(Boolean(initial.team_sport));
  const [matchDays, setMatchDays] = useState<string>(
    initial.match_days_per_week == null ? "" : String(initial.match_days_per_week),
  );
  const [practiceDays, setPracticeDays] = useState<string>(
    initial.practice_days_per_week == null ? "" : String(initial.practice_days_per_week),
  );
  const [seasonPhase, setSeasonPhase] = useState<SeasonPhase | "">(
    (initial.season_phase as SeasonPhase) ?? "",
  );
  const [classTypes, setClassTypes] = useState<string[]>(initial.class_types ?? []);
  const [classDays, setClassDays] = useState<string>(
    initial.class_days_per_week == null ? "" : String(initial.class_days_per_week),
  );
  const [mobilityFreq, setMobilityFreq] = useState<MobilityFreq | "">(
    (initial.mobility_frequency as MobilityFreq) ?? "",
  );
  const [sportWeekdays, setSportWeekdays] = useState<string[]>(initial.sport_weekdays ?? []);
  const [mobilityFocus, setMobilityFocus] = useState(initial.mobility_focus ?? "");
  const [cardioOutside, setCardioOutside] = useState(initial.cardio_outside_gym ?? "");
  const [injuries, setInjuries] = useState(initial.injuries ?? "");
  const [experience, setExperience] = useState<Experience | "">(initial.training_experience ?? "");

  useEffect(() => {
    setSport(initial.sport ?? "");
    setSportPosition(initial.sport_position ?? "");
    setSportLevel((initial.sport_level as SportLevel) ?? "");
    setTeamSport(Boolean(initial.team_sport));
    setMatchDays(initial.match_days_per_week == null ? "" : String(initial.match_days_per_week));
    setPracticeDays(initial.practice_days_per_week == null ? "" : String(initial.practice_days_per_week));
    setSeasonPhase((initial.season_phase as SeasonPhase) ?? "");
    setClassTypes(initial.class_types ?? []);
    setClassDays(initial.class_days_per_week == null ? "" : String(initial.class_days_per_week));
    setMobilityFreq((initial.mobility_frequency as MobilityFreq) ?? "");
    setSportWeekdays(initial.sport_weekdays ?? []);
    setMobilityFocus(initial.mobility_focus ?? "");
    setCardioOutside(initial.cardio_outside_gym ?? "");
    setInjuries(initial.injuries ?? "");
    setExperience(initial.training_experience ?? "");
  }, [initial]);

  const selfFn = useServerFn(updateMyAthleteProfile);
  const coachFn = useServerFn(updateCustomerAthleteProfile);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => {
      const payload: AthleteProfileInput = {
        sport: sport.trim() || null,
        sport_position: sportPosition.trim() || null,
        sport_level: (sportLevel || null) as SportLevel | null,
        team_sport: teamSport,
        match_days_per_week: matchDays === "" ? null : Number(matchDays),
        practice_days_per_week: practiceDays === "" ? null : Number(practiceDays),
        sport_weekdays: sportWeekdays,
        season_phase: (seasonPhase || null) as SeasonPhase | null,
        class_types: classTypes,
        class_days_per_week: classDays === "" ? null : Number(classDays),
        mobility_frequency: (mobilityFreq || null) as MobilityFreq | null,
        mobility_focus: mobilityFocus.trim() || null,
        cardio_outside_gym: cardioOutside.trim() || null,
        injuries: injuries.trim() || null,
        training_experience: (experience || null) as Experience | null,
      };
      if (mode === "self") return selfFn({ data: payload });
      if (!userId) throw new Error("Missing userId");
      return coachFn({ data: { ...payload, user_id: userId } });
    },
    onSuccess: () => {
      toast.success("Trainings-Profil gespeichert");
      qc.invalidateQueries({ queryKey: ["customer-detail", userId] });
      qc.invalidateQueries({ queryKey: ["my-athlete-profile"] });
      onSaved?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const toggleClass = (c: string) =>
    setClassTypes((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Dumbbell className="h-4 w-4 text-gold" />
        <h3 className="font-display text-base font-bold">Trainings- & Sport-Profil</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Diese Angaben fließen direkt in die Smart-Trainingsplan-Erstellung der KI ein.
        Je vollständiger, desto besser passt der Plan zu dir.
      </p>

      <div className="space-y-4">
        {/* Erfahrung */}
        <Field label="Trainings-Erfahrung">
          <div className="grid grid-cols-3 gap-2">
            {(["beginner", "intermediate", "advanced"] as Experience[]).map((opt) => (
              <Pill key={opt} active={experience === opt} onClick={() => setExperience(opt)}>
                {opt === "beginner" ? "Anfänger" : opt === "intermediate" ? "Mittel" : "Fortg."}
              </Pill>
            ))}
          </div>
        </Field>

        {/* Sport */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sportart">
            <input
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              placeholder="z. B. Football, Fußball, Kursleitung"
              maxLength={80}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Position / Rolle (optional)">
            <input
              value={sportPosition}
              onChange={(e) => setSportPosition(e.target.value)}
              placeholder="z. B. Wide Receiver, IV, Goalie"
              maxLength={80}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="Leistungsniveau">
          <div className="flex flex-wrap gap-2">
            {SPORT_LEVELS.map((o) => (
              <Pill key={o.v} active={sportLevel === o.v} onClick={() => setSportLevel(o.v)}>
                {o.l}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Mannschaftssport?">
          <div className="flex gap-2">
            <Pill active={teamSport} onClick={() => setTeamSport(true)}>Ja</Pill>
            <Pill active={!teamSport} onClick={() => setTeamSport(false)}>Nein</Pill>
          </div>
        </Field>

        {teamSport && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Spieltage / Woche">
              <NumInput value={matchDays} onChange={setMatchDays} min={0} max={7} />
            </Field>
            <Field label="Training / Woche">
              <NumInput value={practiceDays} onChange={setPracticeDays} min={0} max={7} />
            </Field>
            <Field label="Saisonphase">
              <select
                value={seasonPhase}
                onChange={(e) => setSeasonPhase(e.target.value as SeasonPhase | "")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {SEASON.map((s) => (
                  <option key={s.v} value={s.v}>{s.l}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {/* Kurse */}
        <Field label="Kurse, die du besuchst (oder leitest)">
          <div className="flex flex-wrap gap-2">
            {CLASS_PRESETS.map((c) => (
              <Pill key={c} active={classTypes.includes(c)} onClick={() => toggleClass(c)}>
                {c}
              </Pill>
            ))}
          </div>
          {classTypes.length > 0 && (
            <div className="mt-2 grid sm:grid-cols-2 gap-2">
              <Field label="Kurstage / Woche" inline>
                <NumInput value={classDays} onChange={setClassDays} min={0} max={7} />
              </Field>
            </div>
          )}
        </Field>

        {/* Mobility */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mobility / Stretching">
            <div className="flex flex-wrap gap-2">
              {MOBILITY.map((m) => (
                <Pill key={m.v} active={mobilityFreq === m.v} onClick={() => setMobilityFreq(m.v)}>
                  {m.l}
                </Pill>
              ))}
            </div>
          </Field>
          <Field label="Mobility-Schwerpunkt (optional)">
            <input
              value={mobilityFocus}
              onChange={(e) => setMobilityFocus(e.target.value)}
              placeholder="z. B. Hüfte, Schultern, BWS"
              maxLength={300}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {/* Extra */}
        <Field label="Cardio außerhalb des Studios (optional)">
          <input
            value={cardioOutside}
            onChange={(e) => setCardioOutside(e.target.value)}
            placeholder="z. B. 2× Laufen, 1× Radfahren"
            maxLength={300}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Verletzungen / Einschränkungen (optional)">
          <textarea
            value={injuries}
            onChange={(e) => setInjuries(e.target.value)}
            placeholder="z. B. Knieprobleme links, Schulter­impingement"
            maxLength={500}
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>

        <div className="flex items-center gap-3">
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> Speichern
          </button>
          {teamSport && (
            <div className="flex items-center gap-1 text-[11px] text-gold">
              <Trophy className="h-3.5 w-3.5" /> Mannschaftssportler-Profil
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  inline,
  children,
}: {
  label: string;
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={inline ? "flex items-center gap-2" : ""}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-gold bg-gold/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
    />
  );
}
