/**
 * Admin — Player Card Regel-Editor (Phase 5).
 * Nur für platform_owner: Positionsgewichtungen und Benchmark-Kurven pflegen.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Sliders,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";
import {
  listPlayerCardPositionWeights,
  listPlayerCardBenchmarks,
  upsertPlayerCardPositionWeight,
  deletePlayerCardPositionWeight,
  upsertPlayerCardBenchmark,
  deletePlayerCardBenchmark,
} from "@/lib/player-cards.functions";

export const Route = createFileRoute("/admin/player-cards")({
  head: () => ({
    meta: [
      { title: "Player Cards — Admin" },
      { name: "description", content: "Positionsgewichtungen und Benchmark-Kurven pflegen." },
    ],
  }),
  component: () => (
    <AppLayout>
      <AdminPage />
    </AppLayout>
  ),
});

type Tab = "positions" | "benchmarks";

const ATTRS = ["SPD", "ACC", "AGI", "POW", "STR", "END"] as const;

function AdminPage() {
  const navigate = useNavigate();
  const { supabaseUser, loading } = useSession();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && !supabaseUser) navigate({ to: "/auth" });
  }, [loading, supabaseUser, navigate]);

  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      const { data } = await supabase.rpc("has_role" as any, {
        _user_id: supabaseUser.id,
        _role: "platform_owner",
      });
      setIsOwner(!!data);
    })();
  }, [supabaseUser]);

  const [tab, setTab] = useState<Tab>("positions");
  const [sport, setSport] = useState<string>("football");

  if (loading || isOwner === null) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="text-sm font-semibold">Kein Zugriff</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Dieser Bereich ist nur für Plattform-Administratoren.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/coach/player-cards"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück
        </Link>
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-bulls-red">
          Player Cards Admin
        </div>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold">Regel-Editor</h1>
        <p className="text-xs text-muted-foreground">
          Positionsgewichtungen und Benchmark-Kurven pro Sport. Änderungen wirken bei jedem neuen Recompute.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="football">American Football</option>
        </select>
        <div className="flex gap-1.5">
          <TabBtn active={tab === "positions"} onClick={() => setTab("positions")} icon={<Sliders className="h-3.5 w-3.5" />} label="Positionen" />
          <TabBtn active={tab === "benchmarks"} onClick={() => setTab("benchmarks")} icon={<Target className="h-3.5 w-3.5" />} label="Benchmarks" />
        </div>
      </div>

      {tab === "positions" ? <PositionsEditor sport={sport} /> : <BenchmarksEditor sport={sport} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-bulls-red text-white" : "border border-border bg-card text-muted-foreground hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// -------------------- Positions --------------------

type PositionRow = {
  id: string;
  sport: string;
  position_key: string;
  label: string;
  w_spd: number; w_acc: number; w_agi: number; w_pow: number; w_str: number; w_end: number;
};

const EMPTY_POS: PositionRow = {
  id: "",
  sport: "football",
  position_key: "",
  label: "",
  w_spd: 1, w_acc: 1, w_agi: 1, w_pow: 1, w_str: 1, w_end: 1,
};

function PositionsEditor({ sport }: { sport: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPlayerCardPositionWeights);
  const upsertFn = useServerFn(upsertPlayerCardPositionWeight);
  const delFn = useServerFn(deletePlayerCardPositionWeight);

  const q = useQuery({
    queryKey: ["pc-positions", sport],
    queryFn: () => listFn({ data: { sport } }),
  });

  const [editing, setEditing] = useState<PositionRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pc-positions", sport] });

  const upsert = useMutation({
    mutationFn: (row: PositionRow) => upsertFn({
      data: {
        id: row.id || null,
        sport: row.sport,
        position_key: row.position_key,
        label: row.label,
        w_spd: row.w_spd, w_acc: row.w_acc, w_agi: row.w_agi,
        w_pow: row.w_pow, w_str: row.w_str, w_end: row.w_end,
      },
    }),
    onSuccess: () => { toast.success("Position gespeichert"); setEditing(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Position gelöscht"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const rows = (q.data?.rows ?? []) as PositionRow[];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing({ ...EMPTY_POS, sport })}
          className="inline-flex items-center gap-1.5 rounded-full bg-bulls-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Neue Position
        </button>
      </div>

      {q.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Keine Positionen für {sport}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Key</th>
                <th className="px-3 py-2 font-semibold">Label</th>
                {ATTRS.map((a) => <th key={a} className="px-2 py-2 text-right font-semibold">{a}</th>)}
                <th className="px-3 py-2 text-right font-semibold">Σ</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sum = r.w_spd + r.w_acc + r.w_agi + r.w_pow + r.w_str + r.w_end;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono font-bold">{r.position_key}</td>
                    <td className="px-3 py-2">{r.label}</td>
                    {ATTRS.map((a) => (
                      <td key={a} className="px-2 py-2 text-right tabular-nums">
                        {(Number((r as any)[`w_${a.toLowerCase()}`]) * 100).toFixed(0)}%
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {(sum * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing({ ...r })}
                          className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold hover:border-bulls-red hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (confirm(`Position ${r.position_key} löschen?`)) del.mutate(r.id); }}
                          className="rounded-full border border-red-500/40 px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PositionEditor
          row={editing}
          busy={upsert.isPending}
          onCancel={() => setEditing(null)}
          onSave={(row) => upsert.mutate(row)}
        />
      )}
    </div>
  );
}

function PositionEditor({
  row, busy, onCancel, onSave,
}: {
  row: PositionRow;
  busy: boolean;
  onCancel: () => void;
  onSave: (r: PositionRow) => void;
}) {
  const [draft, setDraft] = useState<PositionRow>(row);
  const sum = draft.w_spd + draft.w_acc + draft.w_agi + draft.w_pow + draft.w_str + draft.w_end;

  const set = (patch: Partial<PositionRow>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-bold">{draft.id ? "Position bearbeiten" : "Neue Position"}</div>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">Key</span>
            <input
              value={draft.position_key}
              onChange={(e) => set({ position_key: e.target.value.toUpperCase() })}
              placeholder="z.B. QB"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">Label</span>
            <input
              value={draft.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Quarterback"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {ATTRS.map((a) => {
            const k = `w_${a.toLowerCase()}` as keyof PositionRow;
            return (
              <label key={a} className="flex flex-col gap-1 text-[11px]">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground">{a}</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={draft[k] as number}
                  onChange={(e) => set({ [k]: Number(e.target.value) } as any)}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                />
              </label>
            );
          })}
        </div>

        <div className="mt-2 text-[11px] text-muted-foreground">
          Rohsumme: {sum.toFixed(2)} — wird beim Speichern auf 100% normalisiert.
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-white"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-bulls-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------- Benchmarks --------------------

type Anchor = { value: number; score: number };
type BenchmarkRow = {
  id: string;
  sport: string;
  attribute_key: string;
  metric_key: string;
  direction: "higher_is_better" | "lower_is_better";
  weight: number;
  anchors: Anchor[];
};

const EMPTY_BENCH: BenchmarkRow = {
  id: "",
  sport: "football",
  attribute_key: "SPD",
  metric_key: "",
  direction: "higher_is_better",
  weight: 1,
  anchors: [{ value: 0, score: 0 }, { value: 100, score: 99 }],
};

function BenchmarksEditor({ sport }: { sport: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPlayerCardBenchmarks);
  const upsertFn = useServerFn(upsertPlayerCardBenchmark);
  const delFn = useServerFn(deletePlayerCardBenchmark);

  const q = useQuery({
    queryKey: ["pc-benchmarks", sport],
    queryFn: () => listFn({ data: { sport } }),
  });

  const [editing, setEditing] = useState<BenchmarkRow | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pc-benchmarks", sport] });

  const upsert = useMutation({
    mutationFn: (row: BenchmarkRow) => upsertFn({ data: {
      id: row.id || null,
      sport: row.sport,
      attribute_key: row.attribute_key,
      metric_key: row.metric_key,
      direction: row.direction,
      weight: row.weight,
      anchors: row.anchors,
    } }),
    onSuccess: () => { toast.success("Benchmark gespeichert"); setEditing(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Benchmark gelöscht"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const rows = (q.data?.rows ?? []) as BenchmarkRow[];

  const grouped = useMemo(() => {
    const m = new Map<string, BenchmarkRow[]>();
    for (const r of rows) {
      const key = r.attribute_key;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    }
    return m;
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing({ ...EMPTY_BENCH, sport })}
          className="inline-flex items-center gap-1.5 rounded-full bg-bulls-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Neuer Benchmark
        </button>
      </div>

      {q.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Keine Benchmarks für {sport}.
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([attr, list]) => (
            <div key={attr} className="rounded-2xl border border-border bg-card p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-bulls-red">
                {attr}
              </div>
              <div className="space-y-1.5">
                {list.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-mono font-semibold">{r.metric_key}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.direction === "higher_is_better" ? "höher = besser" : "niedriger = besser"} · Gewicht {Number(r.weight).toFixed(2)} · {r.anchors.length} Ankerpunkte
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing({ ...r, anchors: [...r.anchors] })}
                        className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold hover:border-bulls-red hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (confirm(`Benchmark ${r.metric_key} löschen?`)) del.mutate(r.id); }}
                        className="rounded-full border border-red-500/40 px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <BenchmarkEditor
          row={editing}
          busy={upsert.isPending}
          onCancel={() => setEditing(null)}
          onSave={(row) => upsert.mutate(row)}
        />
      )}
    </div>
  );
}

function BenchmarkEditor({
  row, busy, onCancel, onSave,
}: {
  row: BenchmarkRow;
  busy: boolean;
  onCancel: () => void;
  onSave: (r: BenchmarkRow) => void;
}) {
  const [draft, setDraft] = useState<BenchmarkRow>(row);
  const set = (patch: Partial<BenchmarkRow>) => setDraft((d) => ({ ...d, ...patch }));
  const setAnchor = (i: number, patch: Partial<Anchor>) =>
    setDraft((d) => ({ ...d, anchors: d.anchors.map((a, idx) => idx === i ? { ...a, ...patch } : a) }));
  const addAnchor = () => setDraft((d) => ({ ...d, anchors: [...d.anchors, { value: 0, score: 0 }] }));
  const removeAnchor = (i: number) => setDraft((d) => ({ ...d, anchors: d.anchors.filter((_, idx) => idx !== i) }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 max-h-[90vh] overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-bold">{draft.id ? "Benchmark bearbeiten" : "Neuer Benchmark"}</div>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">Attribut</span>
            <select
              value={draft.attribute_key}
              onChange={(e) => set({ attribute_key: e.target.value })}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            >
              {ATTRS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">Metric Key</span>
            <input
              value={draft.metric_key}
              onChange={(e) => set({ metric_key: e.target.value })}
              placeholder="z.B. sprint_40yd"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">Richtung</span>
            <select
              value={draft.direction}
              onChange={(e) => set({ direction: e.target.value as any })}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="higher_is_better">höher = besser</option>
              <option value="lower_is_better">niedriger = besser</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">Gewicht</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={draft.weight}
              onChange={(e) => set({ weight: Number(e.target.value) })}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">Ankerpunkte</div>
            <button
              type="button"
              onClick={addAnchor}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-semibold hover:border-bulls-red hover:text-white"
            >
              <Plus className="h-3 w-3" />
              Hinzufügen
            </button>
          </div>
          <div className="space-y-1.5">
            {draft.anchors.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Messwert"
                  value={a.value}
                  onChange={(e) => setAnchor(i, { value: Number(e.target.value) })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  max={99}
                  step={1}
                  placeholder="Score 0-99"
                  value={a.score}
                  onChange={(e) => setAnchor(i, { score: Number(e.target.value) })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => removeAnchor(i)}
                  disabled={draft.anchors.length <= 2}
                  className="rounded-full border border-red-500/40 px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Ankerpunkte werden beim Speichern nach Messwert aufsteigend sortiert.
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-white"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-bulls-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
