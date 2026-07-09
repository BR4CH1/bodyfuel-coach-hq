import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Heart } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/bodyfuel/session";
import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { Route as OrgLayoutRoute } from "./$orgSlug";
import {
  submitCheckin,
  listMyCheckins,
  type AthleteCheckin,
} from "@/lib/athlete-checkins.functions";
import { ReadinessInsight } from "@/components/readiness/ReadinessInsight";
import {
  listRecentReadinessGateEvents,
  type ReadinessGateEvent,
} from "@/lib/readiness-gate-events.functions";

export const Route = createFileRoute("/$orgSlug/checkin")({
  head: ({ params }) => ({
    meta: [
      { title: `Check-in — ${params.orgSlug}` },
      {
        name: "description",
        content: "Täglicher Check-in: Schlaf, Energie, Stress, Trainingsgefühl, Beschwerden.",
      },
    ],
  }),
  component: OrgCheckinPage,
});

const TODAY = () => new Date().toISOString().slice(0, 10);

function OrgCheckinPage() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(submitCheckin);
  const listFn = useServerFn(listMyCheckins);
  const primary = org.primary_color ?? "#e11d48";

  useEffect(() => {
    if (!loading && !supabaseUser) {
      navigate({ to: "/$orgSlug", params: { orgSlug: org.slug }, replace: true });
    }
  }, [supabaseUser, loading, org.slug, navigate]);

  const { data: history = [] } = useQuery({
    queryKey: ["my-checkins", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => listFn() as Promise<AthleteCheckin[]>,
  });

  const gatesFn = useServerFn(listRecentReadinessGateEvents);
  const { data: gateEvents = [] } = useQuery({
    queryKey: ["my-readiness-gates", supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () =>
      gatesFn({
        data: { userId: supabaseUser!.id, days: 14 },
      }) as Promise<ReadinessGateEvent[]>,
  });

  const today = history.find((c) => c.checkin_date === TODAY());

  const [sleep, setSleep] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [trainingFeel, setTrainingFeel] = useState<number | null>(null);
  const [painLevel, setPainLevel] = useState<number | null>(null);
  const [painNote, setPainNote] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (today) {
      setSleep(today.sleep);
      setEnergy(today.energy);
      setStress(today.stress);
      setTrainingFeel(today.training_feel);
      setPainLevel(today.pain_level);
      setPainNote(today.pain_note ?? "");
      setNotes(today.notes ?? "");
    }
  }, [today?.id]);

  const mut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          organizationId: (org as any).id,
          checkinDate: TODAY(),
          sleep,
          energy,
          stress,
          trainingFeel,
          painLevel,
          painNote: painNote.trim() || null,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Check-in gespeichert.");
      qc.invalidateQueries({ queryKey: ["my-checkins"] });
      qc.invalidateQueries({ queryKey: ["org-home", org.slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <OrgAthleteLayout slug={org.slug} features={[]} primaryColor={primary}>
      <div className="mx-auto max-w-2xl space-y-5 px-4 pb-24 pt-4">
        <Link
          to="/$orgSlug/home"
          params={{ orgSlug: org.slug }}
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück
        </Link>

        <header className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-white"
            style={{ background: primary }}
          >
            <Heart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold uppercase leading-tight tracking-tight">
              Check-in
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Heute ·{" "}
              {new Date().toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>
        </header>

        <ScaleField label="Schlaf" value={sleep} onChange={setSleep} lowLabel="schlecht" highLabel="top" primary={primary} />
        <ScaleField label="Energie" value={energy} onChange={setEnergy} lowLabel="niedrig" highLabel="hoch" primary={primary} />
        <ScaleField label="Stress" value={stress} onChange={setStress} lowLabel="entspannt" highLabel="hoch" primary={primary} />
        <ScaleField
          label="Trainingsgefühl"
          value={trainingFeel}
          onChange={setTrainingFeel}
          lowLabel="platt"
          highLabel="frisch"
          primary={primary}
        />
        <ScaleField
          label="Schmerzen / Beschwerden"
          value={painLevel}
          onChange={setPainLevel}
          min={0}
          lowLabel="keine"
          highLabel="stark"
          primary={primary}
        />

        {painLevel != null && painLevel > 0 && (
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Wo / Was?
            </span>
            <input
              value={painNote}
              onChange={(e) => setPainNote(e.target.value)}
              maxLength={500}
              placeholder="z. B. linke Wade, Zug beim Sprinten"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        )}

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Freitext an Coach (optional)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={3}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Alles, was der Coach wissen sollte."
          />
        </label>

        <button
          type="button"
          disabled={mut.isPending}
          onClick={() => mut.mutate()}
          className="w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
          style={{ background: primary }}
        >
          {mut.isPending ? "Speichert…" : today ? "Check-in aktualisieren" : "Check-in speichern"}
        </button>

        {history.length > 0 && (
          <section className="pt-2">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Dein Verlauf
            </h2>
            <ReadinessInsight rows={history} tone="athlete" />
          </section>
        )}

        {gateEvents.length > 0 && (
          <section className="pt-2">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Dein Plan hört auf dich
            </h2>
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-[12px]">
              <div className="text-orange-300">
                {gateEvents.length === 1
                  ? "Dein Plan wurde 1× automatisch gehalten, weil deine Readiness das nahegelegt hat."
                  : `Dein Plan wurde ${gateEvents.length}× automatisch gehalten — deine Readiness zeigt, dass Steigerungen aktuell zu viel wären.`}{" "}
                Es wird nichts aktiv nach unten geschraubt.
              </div>
              <ul className="mt-2 divide-y divide-orange-500/20">
                {gateEvents.slice(0, 4).map((g) => (
                  <li key={g.id} className="py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {g.exercise_name ?? "Übung"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {new Date(g.source_session_date).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </div>
                    {g.readiness_gate_reason && (
                      <div className="text-muted-foreground">{g.readiness_gate_reason}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section className="pt-4">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Letzte Check-ins
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {history.slice(0, 10).map((c) => (
                <li key={c.id} className="px-3 py-2.5 text-[12px]">
                  <div className="flex justify-between font-semibold">
                    <span>
                      {new Date(c.checkin_date).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </span>
                    <span className="text-muted-foreground">
                      S{c.sleep ?? "–"} · E{c.energy ?? "–"} · St{c.stress ?? "–"} · T
                      {c.training_feel ?? "–"}
                    </span>
                  </div>
                  {c.notes && (
                    <div className="mt-0.5 truncate text-muted-foreground">{c.notes}</div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </OrgAthleteLayout>
  );
}

function ScaleField({
  label,
  value,
  onChange,
  min = 1,
  lowLabel,
  highLabel,
  primary,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  min?: number;
  lowLabel: string;
  highLabel: string;
  primary: string;
}) {
  const options: number[] = [];
  for (let i = min; i <= 5; i++) options.push(i);
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {lowLabel} → {highLabel}
        </span>
      </div>
      <div
        className="mt-1 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="rounded-md border py-2 text-sm font-bold transition-colors"
              style={
                active
                  ? { background: primary, borderColor: primary, color: "#fff" }
                  : undefined
              }
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
