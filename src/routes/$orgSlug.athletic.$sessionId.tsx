import { createFileRoute, useNavigate, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, Dumbbell, Clock, Target, Check, ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { getOrgHomeData } from "@/lib/organizations/athlete.functions";
import { getOrgAthleticSession, completeOrgAthleticSession } from "@/lib/organizations/operating-loop.functions";
import { OrgAthleteLayout } from "@/components/organizations/OrgAthleteLayout";
import { listMyCheckins } from "@/lib/athlete-checkins.functions";
import { summarize, type ReadinessCheckin } from "@/lib/readiness";
import { Route as OrgLayoutRoute } from "./$orgSlug";

export const Route = createFileRoute("/$orgSlug/athletic/$sessionId")({
  component: OrgAthleticSession,
});

function OrgAthleticSession() {
  const { org } = OrgLayoutRoute.useLoaderData();
  const { sessionId } = useParams({ from: "/$orgSlug/athletic/$sessionId" });
  const { supabaseUser } = useSession();
  const navigate = useNavigate();
  const fetch = useServerFn(getOrgAthleticSession);
  const complete = useServerFn(completeOrgAthleticSession);
  const fetchHome = useServerFn(getOrgHomeData);
  const [rating, setRating] = useState<number>(3);
  const [notes, setNotes] = useState("");

  const { data: home } = useQuery({
    queryKey: ["org-home", org.slug, supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchHome({ data: { slug: org.slug } }),
  });
  const { data } = useQuery({
    queryKey: ["org-athletic-session", sessionId],
    enabled: !!supabaseUser,
    queryFn: () => fetch({ data: { session_id: sessionId } }),
  });
  const fetchCheckins = useServerFn(listMyCheckins);
  const { data: checkins } = useQuery({
    queryKey: ["my-checkins", supabaseUser?.id ?? "anon"],
    enabled: !!supabaseUser,
    queryFn: () => fetchCheckins({}),
  });

  const doneMut = useMutation({
    mutationFn: () =>
      complete({ data: { session_id: sessionId, rating, notes: notes || null } }),
    onSuccess: () => navigate({ to: "/$orgSlug/home", params: { orgSlug: org.slug } }),
  });

  const primary = org.primary_color ?? "#e11d48";
  if (!data) return <div className="grid min-h-screen place-items-center text-muted-foreground">Laden…</div>;

  const sess = (data as any).session;
  const plan = (data as any).plan;
  const exercises = ((data as any).exercises ?? []) as any[];

  return (
    <OrgAthleteLayout slug={org.slug} features={(home?.features as any) ?? []} primaryColor={primary}>
      <header className="px-5 py-6 text-white" style={{ background: `linear-gradient(135deg, ${org.primary_color ?? "#000"} 0%, #000 100%)` }}>
        <Link to="/$orgSlug/home" params={{ orgSlug: org.slug }} className="mb-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80">
          <ChevronLeft className="h-3 w-3" /> Home
        </Link>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{plan?.name ?? "Athletic Training"}</div>
        <h1 className="font-display text-2xl font-bold">{sess?.session_name ?? "Session"}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs opacity-90">
          {sess?.estimated_duration_minutes && (
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{sess.estimated_duration_minutes} Min</span>
          )}
          {sess?.focus_areas?.length > 0 && (
            <span className="inline-flex items-center gap-1"><Target className="h-3 w-3" />{sess.focus_areas.join(", ")}</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-4 py-5">
        <ReadinessBanner rows={(checkins ?? []) as ReadinessCheckin[]} />
        {sess?.description && (
          <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">{sess.description}</div>
        )}

        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Übungen</div>
        {exercises.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Für diese Session sind noch keine Übungen konfiguriert.
          </div>
        ) : (
          <ul className="space-y-2">
            {exercises.map((ex, i) => (
              <li key={ex.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-muted text-xs font-bold">{i + 1}</div>
                  <div className="flex-1 font-semibold">{ex.library?.name ?? "Übung"}</div>
                  {ex.library?.exercise_type && (
                    <div className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {ex.library.exercise_type}
                    </div>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {[
                    ex.sets && `${ex.sets} Sätze`,
                    ex.reps && `${ex.reps} Wdh`,
                    ex.duration_seconds && `${ex.duration_seconds} s`,
                    ex.rest_seconds && `${ex.rest_seconds} s Pause`,
                    ex.intensity_target && `Intensität: ${ex.intensity_target}`,
                    ex.rir != null && `RIR ${ex.rir}`,
                    ex.tempo && `Tempo ${ex.tempo}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {ex.notes && <div className="mt-1 text-xs italic text-muted-foreground">{ex.notes}</div>}
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Session abschließen</div>
          <label className="mb-1 block text-xs">Wie war es? ({rating}/5)</label>
          <input
            type="range"
            min={1}
            max={5}
            value={rating}
            onChange={(e) => setRating(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notizen (optional)"
            rows={2}
            className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <button
            onClick={() => doneMut.mutate()}
            disabled={doneMut.isPending}
            className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50"
            style={{ background: primary }}
          >
            <Check className="h-3 w-3" /> {doneMut.isPending ? "Speichere…" : "Session abschließen"}
          </button>
        </div>
      </main>
    </OrgAthleteLayout>
  );
}

function ReadinessBanner({ rows }: { rows: ReadinessCheckin[] }) {
  if (!rows || rows.length === 0) return null;
  const s = summarize(rows);
  const avg7 = s.avg7 ?? null;
  const painCount = rows.slice(0, 7).filter((r) => (r as any).has_pain).length;
  const severe = (avg7 != null && avg7 < 30) || painCount >= 3;
  const soft = !severe && ((avg7 != null && avg7 < 45) || painCount >= 2);
  if (!severe && !soft) return null;
  const tone = severe
    ? "border-red-500/40 bg-red-500/10 text-red-100"
    : "border-orange-400/40 bg-orange-400/10 text-orange-100";
  const title = severe
    ? "Heute halten wir dich bewusst zurück"
    : "Heute vorsichtig — kein Push";
  return (
    <div className={`rounded-2xl border p-3 text-xs ${tone}`}>
      <div className="flex items-center gap-2 font-semibold">
        <ShieldAlert className="h-4 w-4" /> {title}
      </div>
      <p className="mt-1 opacity-90">
        Readiness Ø 7d: <b>{avg7 ?? "—"}</b>
        {painCount > 0 && <> · Schmerzmeldungen (7d): <b>{painCount}</b></>}
        . Der Plan pausiert Steigerungen automatisch, damit dein Körper aufholen kann.
      </p>
    </div>
  );
}
