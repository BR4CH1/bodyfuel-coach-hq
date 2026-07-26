import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Edit3, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import {
  listPendingPerformanceTests,
  listPerformanceCheckStats,
  decidePerformanceTest,
  getVideoSignedUrl,
  getMyPerformanceAccess,
} from "@/lib/bulls-performance.functions";
import { getProfile } from "@/lib/performance-profiles";

export const Route = createFileRoute("/coach/bulls-performance")({
  head: () => ({ meta: [{ title: "Bulls Performance Checks — Coach" }] }),
  component: () => (
    <AppLayout>
      <CoachPage />
    </AppLayout>
  ),
});

function CoachPage() {
  const navigate = useNavigate();
  const { supabaseUser, loading: sessionLoading } = useSession();
  const accessFn = useServerFn(getMyPerformanceAccess);
  const accessQ = useQuery({
    queryKey: ["bulls-perf-access"],
    queryFn: () => accessFn(),
    retry: false,
    staleTime: 60_000,
    enabled: !!supabaseUser,
  });
  const canCoach = accessQ.data?.canCoach === true;

  useEffect(() => {
    if (sessionLoading) return;
    if (!supabaseUser) {
      navigate({ to: "/auth", search: { next: undefined } });
      return;
    }
    if (accessQ.isSuccess && !canCoach) {
      navigate({ to: "/dashboard" });
    }
    if (accessQ.isError) {
      navigate({ to: "/dashboard" });
    }
  }, [sessionLoading, supabaseUser, accessQ.isSuccess, accessQ.isError, canCoach, navigate]);

  const listFn = useServerFn(listPendingPerformanceTests);
  const statsFn = useServerFn(listPerformanceCheckStats);
  const listQ = useQuery({
    queryKey: ["bulls-perf-pending"],
    queryFn: () => listFn(),
    enabled: canCoach,
  });
  const statsQ = useQuery({
    queryKey: ["bulls-perf-stats"],
    queryFn: () => statsFn(),
    enabled: canCoach,
  });

  if (!supabaseUser || accessQ.isPending || (accessQ.isSuccess && !canCoach)) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">
        Zugriff wird geprüft…
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <Link to="/coach" className="text-xs text-muted-foreground hover:text-bulls-red">← Coach-Cockpit</Link>
      <header>
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-bulls-red">Bulls</div>
        <h1 className="font-display text-3xl font-bold">Performance Checks</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Offene Prüfungen" value={statsQ.data?.pending ?? "—"} />
        <Stat label="Getestete Spieler" value={statsQ.data?.playersTested ?? "—"} />
        <Stat label="Verifizierte Ergebnisse" value={statsQ.data?.verifiedResults ?? "—"} />
      </section>

      <section className="space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Offene Prüfungen
        </div>
        {listQ.isLoading && <div className="text-sm text-muted-foreground">Laden…</div>}
        {listQ.data && listQ.data.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aktuell keine offenen Prüfungen.
          </div>
        )}
        {(listQ.data ?? []).map((row: any) => <PendingRow key={row.id} row={row} />)}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function PendingRow({ row }: { row: any }) {
  const qc = useQueryClient();
  const profile = getProfile("football_bulls")!;
  const test = profile.modules.flatMap((m) => m.tests).find((t) => t.id === row.test_id);
  const mod = profile.modules.find((m) => m.tests.some((t) => t.id === row.test_id));

  const decideFn = useServerFn(decidePerformanceTest);
  const videoFn = useServerFn(getVideoSignedUrl);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [correction, setCorrection] = useState("");
  const [mode, setMode] = useState<"idle" | "correct" | "reject">("idle");
  const [rejReason, setRejReason] = useState("");

  const videoQ = useQuery({
    queryKey: ["bulls-video-url", row.video_path],
    queryFn: () => videoFn({ data: { path: row.video_path } }),
    enabled: !!row.video_path,
  });

  async function decide(action: "verify" | "correct" | "reject") {
    setError(null);
    setBusy(action);
    try {
      const payload: any = { id: row.id, action, coach_note: note || null };
      if (action === "correct") {
        const num = parseFloat(correction.replace(",", "."));
        if (!Number.isFinite(num) || num <= 0) throw new Error("Korrigierter Wert ungültig.");
        payload.coach_corrected_value = num;
      }
      if (action === "reject") {
        if (!rejReason.trim()) throw new Error("Ablehnungsgrund erforderlich.");
        payload.rejection_reason = rejReason;
      }
      await decideFn({ data: payload });
      qc.invalidateQueries({ queryKey: ["bulls-perf-pending"] });
      qc.invalidateQueries({ queryKey: ["bulls-perf-stats"] });
    } catch (e: any) {
      setError(e?.message ?? "Fehler");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-bold">{row.player_name}</div>
          <div className="text-xs text-muted-foreground">
            {row.player_position ? `Position ${row.player_position} · ` : ""}
            {mod?.name} · {test?.name ?? row.test_id}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {row.measurement_method && <>Messmethode: {row.measurement_method} · </>}
            {row.surface && <>Untergrund: {row.surface} · </>}
            {row.footwear && <>Schuhe: {row.footwear} · </>}
            {new Date(row.performed_at).toLocaleDateString("de-DE")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Ergebnis</div>
          <div className="font-display text-2xl font-bold tabular-nums">
            {Number(row.result_value).toFixed(2)} <span className="text-xs text-muted-foreground">{row.result_unit}</span>
          </div>
          {row.reps != null && (
            <div className="text-[11px] text-muted-foreground">
              {row.reps} Reps{row.rir != null ? ` · RIR ${row.rir}` : ""}
              {row.bodyweight_kg != null ? ` · BW ${row.bodyweight_kg} kg` : ""}
            </div>
          )}
        </div>
      </div>

      {row.video_path && videoQ.data?.url && (
        <video src={videoQ.data.url} controls className="mt-3 w-full rounded-lg" />
      )}
      {row.video_path && !videoQ.data && (
        <div className="mt-3 text-xs text-muted-foreground">Video wird geladen…</div>
      )}

      <div className="mt-3 space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optionale Notiz für den Spieler"
          rows={2}
          className="w-full rounded-md border border-border bg-background p-2 text-sm outline-none focus:border-bulls-red"
        />

        {mode === "correct" && (
          <input
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder={`Korrigierter Wert (${row.result_unit})`}
            className="w-full rounded-md border border-border bg-background p-2 text-sm outline-none focus:border-bulls-red"
          />
        )}
        {mode === "reject" && (
          <select
            value={rejReason}
            onChange={(e) => setRejReason(e.target.value)}
            className="w-full rounded-md border border-border bg-background p-2 text-sm outline-none focus:border-bulls-red"
          >
            <option value="">Ablehnungsgrund auswählen…</option>
            <option>Startlinie nicht sichtbar.</option>
            <option>Zeitmessung nicht nachvollziehbar.</option>
            <option>Testaufbau falsch.</option>
            <option>Wiederholung entspricht nicht den Bewegungskriterien.</option>
            <option>Video zeigt den vollständigen Versuch nicht.</option>
          </select>
        )}
      </div>

      {error && <div className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{error}</div>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => decide("verify")}
          disabled={!!busy}
          className="inline-flex items-center gap-1 rounded-lg bg-green-600/20 px-3 py-2 text-sm font-semibold text-green-300 hover:bg-green-600/30 disabled:opacity-60"
        >
          {busy === "verify" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Bestätigen
        </button>
        {mode === "correct" ? (
          <button
            onClick={() => decide("correct")}
            disabled={!!busy}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600/20 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-600/30 disabled:opacity-60"
          >
            {busy === "correct" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Edit3 className="h-4 w-4" />}
            Korrektur speichern
          </button>
        ) : (
          <button
            onClick={() => setMode("correct")}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600/20 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-600/30"
          >
            <Edit3 className="h-4 w-4" /> Korrigieren
          </button>
        )}
        {mode === "reject" ? (
          <button
            onClick={() => decide("reject")}
            disabled={!!busy}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600/20 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-600/30 disabled:opacity-60"
          >
            {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Ablehnung senden
          </button>
        ) : (
          <button
            onClick={() => setMode("reject")}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600/20 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-600/30"
          >
            <XCircle className="h-4 w-4" /> Ablehnen
          </button>
        )}
        {mode !== "idle" && (
          <button onClick={() => setMode("idle")} className="text-xs text-muted-foreground hover:underline">
            abbrechen
          </button>
        )}
      </div>
    </div>
  );
}
