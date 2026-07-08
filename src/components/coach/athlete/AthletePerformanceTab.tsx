import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Gauge, Check, X, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import type { CoachAthleteDetail } from "@/lib/organizations/coach-athlete-drilldown.functions";
import {
  listAthletePerformanceTests,
  decidePerformanceTest,
  getVideoSignedUrl,
} from "@/lib/bulls-performance.functions";
import { Section, TrendChip } from "./athlete-tab-shared";

type TestRow = {
  id: string;
  module_id: string;
  test_id: string;
  variant: string | null;
  result_value: number | null;
  result_unit: string | null;
  performed_at: string | null;
  verification_status: "draft" | "submitted" | "verified" | "corrected" | "rejected";
  coach_corrected_value: number | null;
  coach_note: string | null;
  rejection_reason: string | null;
  video_path: string | null;
};

const STATUS_LABEL: Record<TestRow["verification_status"], string> = {
  draft: "Entwurf",
  submitted: "Zur Prüfung",
  verified: "Verifiziert",
  corrected: "Korrigiert",
  rejected: "Abgelehnt",
};

const STATUS_TONE: Record<TestRow["verification_status"], string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-500/15 text-orange-400",
  verified: "bg-green-500/15 text-green-600",
  corrected: "bg-blue-500/15 text-blue-600",
  rejected: "bg-red-500/15 text-red-600",
};

export function AthletePerformanceTab({
  data,
  orgId,
  userId,
}: {
  data: CoachAthleteDetail;
  orgId: string;
  userId: string;
}) {
  const s = data.strength;
  const listFn = useServerFn(listAthletePerformanceTests);
  const { data: rows = [] } = useQuery({
    queryKey: ["athlete-performance-tests", userId],
    queryFn: () => listFn({ data: { userId } }) as Promise<TestRow[]>,
  });

  const submittedCount = rows.filter((r) => r.verification_status === "submitted").length;

  return (
    <div className="space-y-4">
      <Section title="Performance Score" icon={<Gauge className="h-4 w-4" />}>
        {!s ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Noch kein Performance-Test-Ergebnis vorhanden.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Overall
                </div>
                <div className="font-display text-3xl font-bold">{s.overall ?? "—"}</div>
                {s.last_test_at && (
                  <div className="text-[11px] text-muted-foreground">
                    letzte Testung:{" "}
                    {new Date(s.last_test_at).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </div>
                )}
              </div>
              {s.overall_delta != null && <TrendChip delta={s.overall_delta} suffix=" Pkt" />}
            </div>
          </div>
        )}
      </Section>

      {s && (
        <Section title="Kategorien" icon={<Dumbbell className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-2">
            {s.categories.map((c) => (
              <div key={c.key} className="rounded-lg border border-border bg-card p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {c.label}
                </div>
                <div className="mt-1 flex items-end justify-between">
                  <div className="font-display text-xl font-bold">{c.score ?? "—"}</div>
                  {c.delta != null ? <TrendChip delta={c.delta} suffix="" /> : null}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section
        title={`Testergebnisse${submittedCount > 0 ? ` · ${submittedCount} offen` : ""}`}
        icon={<Gauge className="h-4 w-4" />}
      >
        {rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Noch keine Performance-Tests eingereicht.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <TestCard key={r.id} row={r} userId={userId} />
            ))}
          </ul>
        )}
      </Section>

      <Link
        to="/coach/bulls-performance"
        className="mt-1 inline-flex rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        Alle offenen Prüfungen im Prüfbereich →
      </Link>
    </div>
  );
}

function TestCard({ row, userId }: { row: TestRow; userId: string }) {
  const qc = useQueryClient();
  const decideFn = useServerFn(decidePerformanceTest);
  const videoFn = useServerFn(getVideoSignedUrl);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [correctVal, setCorrectVal] = useState<string>(
    row.result_value != null ? String(row.result_value) : "",
  );
  const [reason, setReason] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["athlete-performance-tests", userId] });
    qc.invalidateQueries({ queryKey: ["coach-athlete-detail"] });
  };

  const decide = useMutation({
    mutationFn: (v: {
      action: "verify" | "correct" | "reject";
      coach_corrected_value?: number;
      rejection_reason?: string;
    }) => decideFn({ data: { id: row.id, ...v } }),
    onSuccess: () => {
      invalidate();
      toast.success("Entscheidung gespeichert.");
      setShowCorrect(false);
      setShowReject(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openVideo = async () => {
    if (!row.video_path) return;
    try {
      const url = await videoFn({ data: { path: row.video_path } });
      setVideoUrl(url as unknown as string);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const dateStr = row.performed_at
    ? new Date(row.performed_at).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
    : "—";
  const displayValue =
    row.coach_corrected_value != null ? row.coach_corrected_value : row.result_value;
  const canDecide = row.verification_status === "submitted";

  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {row.module_id} · {row.test_id}
            {row.variant ? ` · ${row.variant}` : ""}
          </div>
          <div className="mt-0.5 text-sm font-semibold">
            {displayValue != null ? `${displayValue} ${row.result_unit ?? ""}` : "—"}
            {row.coach_corrected_value != null && row.result_value != null && (
              <span className="ml-2 text-[11px] text-muted-foreground line-through">
                {row.result_value} {row.result_unit ?? ""}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">{dateStr}</div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            STATUS_TONE[row.verification_status]
          }`}
        >
          {STATUS_LABEL[row.verification_status]}
        </span>
      </div>

      {row.rejection_reason && (
        <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1 text-[11px] text-red-600">
          Ablehnungsgrund: {row.rejection_reason}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {row.video_path && (
          <button
            type="button"
            onClick={openVideo}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Play className="h-3 w-3" />
            Video
          </button>
        )}
        {canDecide && (
          <>
            <button
              type="button"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ action: "verify" })}
              className="inline-flex items-center gap-1 rounded-md bg-green-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-green-600 hover:bg-green-500/25 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              Bestätigen
            </button>
            <button
              type="button"
              onClick={() => setShowCorrect((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:bg-blue-500/25"
            >
              <Pencil className="h-3 w-3" />
              Korrigieren
            </button>
            <button
              type="button"
              onClick={() => setShowReject((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600 hover:bg-red-500/25"
            >
              <X className="h-3 w-3" />
              Ablehnen
            </button>
          </>
        )}
      </div>

      {showCorrect && canDecide && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            value={correctVal}
            onChange={(e) => setCorrectVal(e.target.value)}
            className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm"
            placeholder="Wert"
          />
          <span className="text-[11px] text-muted-foreground">{row.result_unit ?? ""}</span>
          <button
            type="button"
            disabled={decide.isPending || correctVal === ""}
            onClick={() =>
              decide.mutate({ action: "correct", coach_corrected_value: Number(correctVal) })
            }
            className="rounded-md bg-blue-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      )}

      {showReject && canDecide && (
        <div className="mt-2 space-y-1.5">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Grund (z. B. Video unvollständig, unklare Technik…)"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
            rows={2}
          />
          <button
            type="button"
            disabled={decide.isPending || reason.trim().length === 0}
            onClick={() => decide.mutate({ action: "reject", rejection_reason: reason.trim() })}
            className="rounded-md bg-red-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            Ablehnen
          </button>
        </div>
      )}

      {videoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setVideoUrl(null)}
        >
          <video
            src={videoUrl}
            controls
            autoPlay
            className="max-h-full max-w-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </li>
  );
}
