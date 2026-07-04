import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Dumbbell, Loader2, ShieldAlert, Sparkles, TimerReset, Trophy } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { StrengthScoreDonut } from "@/components/bodyfuel/StrengthScoreDonut";
import { useSession } from "@/lib/bodyfuel/session";
import {
  STRENGTH_TESTS,
  completeStrengthCheck,
  deleteStrengthResult,
  getMyStrengthStatus,
  saveStrengthResult,
  startStrengthCheck,
  type StrengthCheck,
  type StrengthResult,
  type StrengthTestKey,
} from "@/lib/strength-check.functions";
import { AthleteProfileBanner } from "@/components/bodyfuel/AthleteProfileBanner";

export const Route = createFileRoute("/strength-check")({
  head: () => ({ meta: [{ title: "BODYFUEL Strength Check" }] }),
  component: () => (
    <AppLayout>
      <StrengthCheckPage />
    </AppLayout>
  ),
});

type WizardResult = {
  weight: string;
  reps: string;
  duration: string;
  rpe: number;
  pain: string;
};

const emptyResult = (): WizardResult => ({ weight: "", reps: "", duration: "", rpe: 7, pain: "" });

const DRAFT_KEY = "bf.strengthCheck.draft.v1";

type LocalDraft = {
  bodyweight: string;
  stepIdx: number;
  values: Record<StrengthTestKey, WizardResult>;
  intro: boolean;
};

function loadDraft(): LocalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalDraft;
  } catch {
    return null;
  }
}

function StrengthCheckPage() {
  const { supabaseUser } = useSession();
  const startFn = useServerFn(startStrengthCheck);
  const saveFn = useServerFn(saveStrengthResult);
  const completeFn = useServerFn(completeStrengthCheck);
  const removeFn = useServerFn(deleteStrengthResult);
  const statusFn = useServerFn(getMyStrengthStatus);
  const navigate = useNavigate();

  const draft = useMemo(() => loadDraft(), []);

  const [intro, setIntro] = useState(() => (draft ? draft.intro : true));
  const [bodyweight, setBodyweight] = useState(() => draft?.bodyweight ?? "");
  const [check, setCheck] = useState<StrengthCheck | null>(null);
  const [stepIdx, setStepIdx] = useState(() => draft?.stepIdx ?? 0);
  const [values, setValues] = useState<Record<StrengthTestKey, WizardResult>>(() => {
    const map = {} as Record<StrengthTestKey, WizardResult>;
    for (const t of STRENGTH_TESTS) map[t.key] = emptyResult();
    if (draft?.values) {
      for (const t of STRENGTH_TESTS) {
        if (draft.values[t.key]) map[t.key] = { ...map[t.key], ...draft.values[t.key] };
      }
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<StrengthCheck | null>(null);
  const [lastSummary, setLastSummary] = useState<StrengthCheck | null>(null);

  // Persist draft locally so phone-lock / PWA reload doesn't lose progress.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload: LocalDraft = { bodyweight, stepIdx, values, intro };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      /* quota / private mode */
    }
  }, [bodyweight, stepIdx, values, intro]);

  // Preload last completed for delta comparison.
  useEffect(() => {
    let cancelled = false;
    if (!supabaseUser) return;
    statusFn().then((s) => {
      if (!cancelled && s.last) setLastSummary(s.last);
    });
    return () => {
      cancelled = true;
    };
  }, [supabaseUser, statusFn]);

  // If we resumed past the intro from a local draft, re-attach to (or create) the server-side draft check.
  useEffect(() => {
    if (!supabaseUser || intro || check) return;
    let cancelled = false;
    (async () => {
      try {
        const bw = bodyweight.trim() === "" ? null : Number(bodyweight.replace(",", "."));
        const row = await startFn({
          data: { bodyweight_kg: bw !== null && Number.isFinite(bw) && bw > 0 ? bw : null },
        });
        if (!cancelled) setCheck(row);
      } catch {
        /* on failure, force back to intro so user can start clean */
        if (!cancelled) setIntro(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseUser, intro, check, startFn, bodyweight]);

  if (!supabaseUser) return null;

  const begin = async () => {
    const bw = bodyweight.trim() === "" ? null : Number(bodyweight.replace(",", "."));
    if (bw !== null && (Number.isNaN(bw) || bw <= 0 || bw > 300)) {
      toast.error("Körpergewicht ungültig");
      return;
    }
    setSaving(true);
    try {
      const row = await startFn({ data: { bodyweight_kg: bw } });
      setCheck(row);
      // Hydrate existing draft values
      const status = await statusFn();
      if (status.last && status.last.id === row.id) {
        const v = { ...values };
        for (const r of status.last.results) {
          v[r.test_key] = {
            weight: r.weight_kg != null ? String(r.weight_kg).replace(".", ",") : "",
            reps: r.reps != null ? String(r.reps) : "",
            duration: r.duration_seconds != null ? String(r.duration_seconds) : "",
            rpe: r.rpe ?? 7,
            pain: r.pain_note ?? "",
          };
        }
        setValues(v);
      }
      setIntro(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Konnte nicht starten");
    } finally {
      setSaving(false);
    }
  };

  const current = STRENGTH_TESTS[stepIdx];
  const v = values[current.key];

  const setField = <K extends keyof WizardResult>(key: K, val: WizardResult[K]) => {
    setValues((cur) => ({ ...cur, [current.key]: { ...cur[current.key], [key]: val } }));
  };

  const saveStep = async (advance: boolean) => {
    if (!check) return;
    setSaving(true);
    try {
      let weight_kg: number | null = null;
      let reps: number | null = null;
      let duration_seconds: number | null = null;
      if (current.kind === "weighted") {
        weight_kg = v.weight.trim() ? Number(v.weight.replace(",", ".")) : null;
        reps = v.reps.trim() ? Number(v.reps) : null;
        if (weight_kg !== null && (Number.isNaN(weight_kg) || weight_kg < 0)) {
          throw new Error("Gewicht ungültig");
        }
        if (reps !== null && (Number.isNaN(reps) || reps < 0 || reps > 50)) {
          throw new Error("Wiederholungen ungültig (0–50)");
        }
      } else {
        duration_seconds = v.duration.trim() ? Number(v.duration) : null;
        if (duration_seconds !== null && (Number.isNaN(duration_seconds) || duration_seconds < 0 || duration_seconds > 900)) {
          throw new Error("Dauer ungültig (0–900s)");
        }
      }
      const hasData = weight_kg !== null || reps !== null || duration_seconds !== null || v.pain.trim();
      if (hasData) {
        await saveFn({
          data: {
            check_id: check.id,
            test_key: current.key,
            weight_kg,
            reps,
            duration_seconds,
            rpe: v.rpe,
            pain_note: v.pain.trim() || null,
          },
        });
      }
      if (advance && stepIdx < STRENGTH_TESTS.length - 1) setStepIdx(stepIdx + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    if (!check) return;
    try {
      await removeFn({ data: { check_id: check.id, test_key: current.key } });
      setValues((cur) => ({ ...cur, [current.key]: emptyResult() }));
      if (stepIdx < STRENGTH_TESTS.length - 1) setStepIdx(stepIdx + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  };

  const submit = async () => {
    if (!check) return;
    setSubmitting(true);
    try {
      await saveStep(false);
      const finished = await completeFn({ data: { check_id: check.id } });
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setCompleted(finished);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Konnte nicht abschließen");
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return <ResultScreen check={completed} previous={lastSummary} onClose={() => navigate({ to: "/training" })} />;
  }

  if (intro) {
    return (
      <IntroScreen
        bodyweight={bodyweight}
        setBodyweight={setBodyweight}
        onStart={begin}
        loading={saving}
        previous={lastSummary}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/training" className="text-xs text-muted-foreground hover:text-foreground">
          ← Abbrechen
        </Link>
        <div className="text-xs uppercase tracking-wider text-gold">
          Test {stepIdx + 1} / {STRENGTH_TESTS.length}
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-gold transition-all"
          style={{ width: `${((stepIdx + 1) / STRENGTH_TESTS.length) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold">
          <Dumbbell className="h-4 w-4" /> {current.group === "lower" ? "Unterkörper" : current.group === "push" ? "Push" : current.group === "pull" ? "Pull" : "Core"}
        </div>
        <h2 className="mt-1 font-display text-2xl font-bold">{current.label}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {current.kind === "weighted"
            ? "Wähle ein Gewicht, mit dem du 8–10 saubere Wiederholungen schaffst. Kein Maximalversuch!"
            : "Halte so lange wie möglich mit sauberer Form. Bei Abbruch der Form: Zeit stoppen."}
        </p>

        <div className="mt-5 grid gap-3">
          {current.kind === "weighted" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gewicht (kg)">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={v.weight}
                  onChange={(e) => setField("weight", e.target.value.replace(/[^0-9.,]/g, ""))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Wiederholungen">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={v.reps}
                  onChange={(e) => setField("reps", e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>
          ) : (
            <Field label="Maximale Zeit (Sekunden)">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={v.duration}
                onChange={(e) => setField("duration", e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          )}

          <Field label={`Anstrengung (RPE) — ${v.rpe}/10`}>
            <input
              type="range"
              min={1}
              max={10}
              value={v.rpe}
              onChange={(e) => setField("rpe", Number(e.target.value))}
              className="w-full accent-[var(--gold)]"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>locker</span><span>sehr schwer</span>
            </div>
          </Field>

          <Field label="Schmerzen / Einschränkungen">
            <textarea
              rows={2}
              value={v.pain}
              onChange={(e) => setField("pain", e.target.value)}
              placeholder="z. B. leichtes Ziehen im rechten Knie"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
            disabled={stepIdx === 0}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Zurück
          </button>
          <button
            type="button"
            onClick={skip}
            className="rounded-md px-2 py-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Überspringen
          </button>
          {stepIdx < STRENGTH_TESTS.length - 1 ? (
            <button
              type="button"
              onClick={() => saveStep(true)}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md bg-gradient-gold px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              Speichern &amp; weiter
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md bg-gradient-gold px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Abschließen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function IntroScreen({
  bodyweight,
  setBodyweight,
  onStart,
  loading,
  previous,
}: {
  bodyweight: string;
  setBodyweight: (v: string) => void;
  onStart: () => void;
  loading: boolean;
  previous: StrengthCheck | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-gold">🏋️ BODYFUEL</div>
        <h1 className="mt-1 font-display text-3xl font-bold">Strength Check</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Eine kurze Standortbestimmung mit 7 Übungen. Daraus berechnen wir deinen
          BodyFuel Strength Score und können dir bessere Startgewichte vorschlagen.
        </p>
      </div>

      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5 text-sm">
        <div className="mb-2 flex items-center gap-2 text-gold">
          <ShieldAlert className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider">Wichtige Hinweise</span>
        </div>
        <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
          <li>Kein Maximalkrafttest, keine 1RM-Versuche.</li>
          <li>Wähle ein Gewicht, mit dem du <strong>8–10 saubere Wiederholungen</strong> schaffst.</li>
          <li>Trainiere <strong>nicht bis zum kompletten Muskelversagen</strong>.</li>
          <li>Technik geht immer vor Gewicht.</li>
          <li>Bei Schmerzen sofort abbrechen und die Einschränkung notieren.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Dein aktuelles Körpergewicht</div>
        <div className="mt-2 flex items-end gap-2">
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9.,]*"
            value={bodyweight}
            onChange={(e) => setBodyweight(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder="z. B. 82,5"
            className="w-32 rounded-md border border-input bg-background px-3 py-2 text-base"
          />
          <span className="pb-2 text-sm text-muted-foreground">kg</span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Optional, hilft aber bei der relativen Bewertung deiner Werte.
        </p>
      </div>

      {previous && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Dein letzter Check</div>
          <div className="mt-2 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-gold" />
            <div>
              <div className="font-display text-2xl font-bold">{previous.score_total ?? "—"}<span className="text-base text-muted-foreground">/100</span></div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(previous.performed_at).toLocaleDateString("de-DE")}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Strength Check starten
      </button>
    </div>
  );
}

function ResultScreen({ check, previous, onClose }: { check: StrengthCheck; previous: StrengthCheck | null; onClose: () => void }) {
  const conf = check.category_confidence;
  const groups = [
    { key: "score_lower", label: "Unterkörper", cat: conf?.lower },
    { key: "score_push", label: "Push", cat: conf?.push },
    { key: "score_pull", label: "Pull", cat: conf?.pull },
    { key: "score_core", label: "Core", cat: conf?.core },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-gold">Geschafft!</div>
        <h1 className="mt-1 font-display text-3xl font-bold">Dein Strength Score</h1>
      </div>

      <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 to-transparent p-6">
        <div className="text-center text-xs uppercase tracking-wider text-gold">🔥 BodyFuel Strength Score</div>
        <div className="mt-3 flex justify-center">
          <StrengthScoreDonut value={check.score_total} size={160} stroke={14} />
        </div>
        {previous?.score_total != null && check.score_total != null && (
          <div className="mt-2 text-center text-xs text-muted-foreground">
            vorher {previous.score_total} ·{" "}
            <span className={check.score_total >= previous.score_total ? "text-emerald-400" : "text-red-400"}>
              {check.score_total - previous.score_total >= 0 ? "+" : ""}
              {check.score_total - previous.score_total}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {groups.map((g) => {
          const val = check[g.key];
          const prev = previous?.[g.key] ?? null;
          return <ScoreTile key={g.key} label={g.label} value={val} previous={prev} cat={g.cat} />;
        })}
      </div>



      <AthleteProfileBanner force />

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-semibold text-primary-foreground shadow-gold"
        >
          Zum Training
        </button>
        <Link
          to="/strength-check"
          reloadDocument
          className="flex-1 rounded-xl border border-border px-4 py-3 text-center text-sm"
        >
          Neuen Check starten
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
        <TimerReset className="mr-1 inline h-3.5 w-3.5" />
        Dein nächster Strength Check ist in 6 Wochen wieder fällig — wir erinnern dich rechtzeitig.
      </div>
    </div>
  );
}

function ScoreTile({ label, value, previous }: { label: string; value: number | null; previous: number | null }) {
  const delta = value != null && previous != null ? value - previous : null;
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4">
      <StrengthScoreDonut value={value} size={84} stroke={9} />
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {delta != null && (
        <div className={`text-[11px] ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {delta >= 0 ? "+" : ""}{delta} ggü. vorher
        </div>
      )}
    </div>
  );
}
