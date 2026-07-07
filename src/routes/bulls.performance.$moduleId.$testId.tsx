import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Clock, XCircle, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { getProfile } from "@/lib/performance-profiles";
import {
  listMyPerformanceTests,
  submitPerformanceTest,
  createVideoUploadUrl,
  getVideoSignedUrl,
} from "@/lib/bulls-performance.functions";
import { getBullsProfile } from "@/lib/bulls.functions";
import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";
import type { TestResult } from "@/lib/performance-profiles/types";

export const Route = createFileRoute("/bulls/performance/$moduleId/$testId")({
  head: () => ({ meta: [{ title: "Test — Bulls Performance" }] }),
  component: TestDetailPage,
});

function TestDetailPage() {
  const { moduleId, testId } = Route.useParams();
  const { supabaseUser } = useSession();
  const profile = getProfile("football_bulls")!;
  const mod = profile.modules.find((m) => m.id === moduleId);
  const test = mod?.tests.find((t) => t.id === testId);

  const testsFn = useServerFn(listMyPerformanceTests);
  const bpFn = useServerFn(getBullsProfile);
  const testsQ = useQuery({ queryKey: ["bulls-perf-tests"], queryFn: () => testsFn(), enabled: !!supabaseUser });
  const bpQ = useQuery({ queryKey: ["bulls-profile"], queryFn: () => bpFn(), enabled: !!supabaseUser });

  if (!mod || !test) {
    return (
      <div className="space-y-4">
        <Link to="/bulls/performance" className="text-xs text-muted-foreground">← Performance</Link>
        <div className="rounded-xl border border-border bg-card p-6 text-sm">Unbekannter Test.</div>
      </div>
    );
  }

  const history = ((testsQ.data ?? []) as TestResult[])
    .filter((r) => r.test_id === testId)
    .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());

  return (
    <div className="space-y-6">
      <Link to="/bulls/performance/$moduleId" params={{ moduleId }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-bulls-red">
        ← {mod.name}
      </Link>

      <header>
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-bulls-red">{mod.name}</div>
        <h1 className="font-display text-3xl font-bold">{test.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{test.short}</p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Anleitung</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {test.instructions.map((i, idx) => <li key={idx}>{i}</li>)}
        </ol>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Equipment</div>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {test.equipment.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Video-Anforderungen</div>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {test.videoRequirements.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {test.demoVideoUrl && <DemoVideo url={test.demoVideoUrl} />}

      <SubmitForm moduleId={moduleId} testId={testId} test={test} playerPosition={bpQ.data?.position ?? null} />

      <section className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Verlauf</div>
        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Noch keine Versuche.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((r) => (
              <HistoryEntry key={r.id} r={r} unit={test.unit} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function HistoryEntry({ r, unit }: { r: TestResult; unit: string }) {
  const [showVideo, setShowVideo] = useState(false);
  const videoFn = useServerFn(getVideoSignedUrl);
  const videoQ = useQuery({
    queryKey: ["bulls-video-url", r.video_path],
    queryFn: () => videoFn({ data: { path: r.video_path! } }),
    enabled: showVideo && !!r.video_path,
  });
  return (
    <li className="rounded-xl border border-border bg-card p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums font-semibold">
            {Number(r.coach_corrected_value ?? r.result_value).toFixed(2)} {unit}
          </span>
          {r.coach_corrected_value != null && (
            <span className="text-[11px] text-muted-foreground">
              (Original {Number(r.result_value).toFixed(2)})
            </span>
          )}
          <StatusBadge status={r.verification_status} />
          <span className="text-xs text-muted-foreground">
            {new Date(r.performed_at).toLocaleDateString("de-DE")}
          </span>
        </div>
        {r.video_path && (
          <button
            onClick={() => setShowVideo((s) => !s)}
            className="text-xs text-bulls-red hover:underline"
          >
            {showVideo ? "Video schließen" : "Video ansehen"}
          </button>
        )}
      </div>
      {r.coach_note && (
        <div className="mt-2 rounded-md bg-secondary p-2 text-xs">
          <span className="font-semibold">Coach:</span> {r.coach_note}
        </div>
      )}
      {r.rejection_reason && (
        <div className="mt-2 rounded-md bg-red-500/10 p-2 text-xs text-red-200">
          <span className="font-semibold">Ablehnungsgrund:</span> {r.rejection_reason}
        </div>
      )}
      {showVideo && videoQ.data?.url && (
        <video src={videoQ.data.url} controls className="mt-3 w-full rounded-lg" />
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: TestResult["verification_status"] }) {
  if (status === "verified" || status === "corrected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-green-500/15 px-2 py-0.5 text-xs text-green-300">
        <CheckCircle2 className="h-3 w-3" /> {status === "corrected" ? "Coach korrigiert" : "Coach verified"}
      </span>
    );
  }
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
        <Clock className="h-3 w-3" /> Zur Prüfung
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-xs text-red-300">
        <XCircle className="h-3 w-3" /> Abgelehnt
      </span>
    );
  }
  return null;
}

function SubmitForm({
  moduleId,
  testId,
  test,
  playerPosition,
}: {
  moduleId: string;
  testId: string;
  test: NonNullable<ReturnType<typeof getProfile>>["modules"][number]["tests"][number];
  playerPosition: string | null;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitPerformanceTest);
  const uploadFn = useServerFn(createVideoUploadUrl);

  const [value, setValue] = useState("");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState("");
  const [bw, setBw] = useState("");
  const [variant, setVariant] = useState<string | undefined>(test.variants?.[0]?.id);
  const [method, setMethod] = useState("hand");
  const [surface, setSurface] = useState("grass");
  const [footwear, setFootwear] = useState("cleats");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    const num = parseFloat(value.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) {
      setError("Bitte einen gültigen Wert eingeben.");
      return;
    }
    if (!videoFile) {
      setError("Ein Video ist erforderlich, damit der Coach den Versuch bestätigen kann.");
      return;
    }
    setSubmitting(true);
    try {
      // 1) Get signed upload URL
      const ext = videoFile.name.split(".").pop() || "mp4";
      const up = await uploadFn({ data: { test_id: testId, ext } });
      // 2) Upload via storage client
      const { error: upErr } = await supabase.storage
        .from("bulls-performance-videos")
        .uploadToSignedUrl(up.path, up.token, videoFile, { contentType: videoFile.type || "video/mp4" });
      if (upErr) throw new Error("Video-Upload fehlgeschlagen: " + upErr.message);
      // 3) Submit result
      await submitFn({
        data: {
          module_id: moduleId,
          test_id: testId,
          variant: variant ?? null,
          result_value: num,
          result_unit: test.unit,
          reps: test.inputs.reps && reps ? parseInt(reps, 10) : null,
          rir: test.inputs.rir && rir ? parseFloat(rir.replace(",", ".")) : null,
          bodyweight_kg: test.inputs.bodyweight && bw ? parseFloat(bw.replace(",", ".")) : null,
          measurement_method: test.inputs.measurementMethod ? (method as any) : null,
          surface: test.inputs.surface ? (surface as any) : null,
          footwear: test.inputs.footwear ? (footwear as any) : null,
          video_path: up.path,
        },
      });
      setOk(true);
      setValue(""); setReps(""); setRir(""); setBw(""); setVideoFile(null);
      qc.invalidateQueries({ queryKey: ["bulls-perf-tests"] });
      setTimeout(() => navigate({ to: "/bulls/performance/$moduleId", params: { moduleId } }), 800);
    } catch (err: any) {
      setError(err?.message ?? "Fehler beim Einreichen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-bulls-red/40 bg-card p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-bulls-red">
        Ergebnis einreichen
      </div>
      {!playerPosition && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>Ohne Position wird kein Score berechnet. Setze deine Position im Bulls-Onboarding.</div>
        </div>
      )}

      {test.variants && (
        <Field label="Variante">
          <select value={variant} onChange={(e) => setVariant(e.target.value)} className={inputCls}>
            {test.variants.map((v: any) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </Field>
      )}

      <Field label={`Ergebnis (${test.unit})`}>
        <input
          type="text" inputMode="decimal"
          value={value} onChange={(e) => setValue(e.target.value)}
          placeholder={test.unit === "s" ? "z. B. 1.82" : test.unit === "cm" ? "z. B. 273" : "z. B. 140"}
          className={inputCls} required
        />
      </Field>

      {test.inputs.reps && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Reps">
            <input type="number" min="1" value={reps} onChange={(e) => setReps(e.target.value)} className={inputCls} />
          </Field>
          <Field label="RIR / RPE">
            <input type="text" inputMode="decimal" value={rir} onChange={(e) => setRir(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Bodyweight (kg)">
            <input type="text" inputMode="decimal" value={bw} onChange={(e) => setBw(e.target.value)} className={inputCls} />
          </Field>
        </div>
      )}

      {(test.inputs.measurementMethod || test.inputs.surface || test.inputs.footwear) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {test.inputs.measurementMethod && (
            <Field label="Messmethode">
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
                <option value="hand">Handstoppung</option>
                <option value="video">Videozeitmessung</option>
                <option value="timing_gates">Timing Gates</option>
              </select>
            </Field>
          )}
          {test.inputs.surface && (
            <Field label="Untergrund">
              <select value={surface} onChange={(e) => setSurface(e.target.value)} className={inputCls}>
                <option value="grass">Rasen</option>
                <option value="turf">Kunstrasen</option>
                <option value="indoor">Halle</option>
                <option value="track">Track</option>
                <option value="other">Sonstiges</option>
              </select>
            </Field>
          )}
          {test.inputs.footwear && (
            <Field label="Schuhe">
              <select value={footwear} onChange={(e) => setFootwear(e.target.value)} className={inputCls}>
                <option value="cleats">Cleats</option>
                <option value="turfs">Turfs</option>
                <option value="runners">Laufschuhe</option>
                <option value="indoor">Hallenschuhe</option>
                <option value="other">Sonstiges</option>
              </select>
            </Field>
          )}
        </div>
      )}

      <Field label="Video (Pflicht)">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 p-3 text-sm hover:border-bulls-red/60">
          <Upload className="h-4 w-4" />
          <span className="truncate">
            {videoFile ? videoFile.name : "Video auswählen (mp4, mov, webm)"}
          </span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </Field>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      )}
      {ok && (
        <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-200">
          Ergebnis übermittelt — der Bulls Coach prüft deinen Versuch.
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 rounded-lg bg-bulls-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-bulls-red/90 disabled:opacity-60"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Wird eingereicht…" : "Ergebnis einreichen"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-bulls-red";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts)\/([^/]+)/);
      if (m) return m[2];
    }
  } catch {}
  return null;
}

function DemoVideo({ url }: { url: string }) {
  const id = extractYouTubeId(url);
  return (
    <section className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Demo-Video</div>
      {id ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-black">
          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${id}`}
              title="Test-Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-bulls-red hover:underline">
          Demo auf YouTube ansehen
        </a>
      )}
    </section>
  );
}
