/**
 * Player Card — Interaktiver Layout-Editor.
 *
 * Lädt das aktuelle globale Design (Template-Bild + Layout) aus der DB,
 * erlaubt Drag & Drop der Overlay-Elemente, Upload eines neuen Templates
 * und veröffentlicht das Design für alle Athleten.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { PlayerCard } from "@/components/player-cards/PlayerCard";
import {
  DEFAULT_LAYOUT,
  VB_H,
  VB_W,
  mergeLayout,
  type PlayerCardLayout,
} from "@/lib/player-cards/layout";
import { getPlayerCardDesign, savePlayerCardDesign } from "@/lib/player-cards/design.functions";
import { CheckCircle2, Loader2, RotateCcw, Save, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/coach/player-cards_/layout")({
  head: () => ({ meta: [{ title: "Player Card Layout Editor" }] }),
  component: () => (
    <AppLayout>
      <LayoutEditorPage />
    </AppLayout>
  ),
});

type ElementKey = keyof PlayerCardLayout;

const LABELS: Record<ElementKey, string> = {
  ovr: "OVR (Zahl)",
  pos: "Position",
  jersey: "Trikot #",
  age: "Alter",
  height: "Größe",
  weight: "Gewicht",
  spd: "SPD",
  acc: "ACC",
  agi: "AGI",
  pow: "POW",
  str: "STR",
  end: "END",
  updateDate: "Update-Datum",
  strongest: "Stärkstes Attribut",
  photo: "Spielerfoto-Position",
};

// Leere Vorschau — es gibt nur EINE Vorlage für ALLE Spieler.
// Werte werden pro Athlet automatisch aus den Performance-Tests gezogen.
const DEMO_DATA: any = {
  card: {
    bfr: null, spd: null, acc: null, agi: null, pow: null, str: null, end_score: null,
    tier: null, is_provisional: false, position_key: null,
    strongest_attribute: null, computed_at: new Date().toISOString(),
    manual_overrides: {}, is_published: true,
  },
  profile: { display_name: null, nickname: null, avatar_url: null, birthdate: null, height_cm: null, sport_position: null },
  bullsProfile: { first_name: null, last_name: null, weight_kg: null, height_cm: null, position: null },
  organization: null,
  jerseyNumber: null,
};

function LayoutEditorPage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getPlayerCardDesign);
  const saveFn = useServerFn(savePlayerCardDesign);

  const design = useQuery({
    queryKey: ["player-card-design"],
    queryFn: () => fetchFn(),
  });

  const [layout, setLayout] = useState<PlayerCardLayout>(DEFAULT_LAYOUT);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [templateDirty, setTemplateDirty] = useState(false);
  const [selected, setSelected] = useState<ElementKey>("ovr");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ key: ElementKey; mode: "move" | "resize"; startX: number; startY: number; initial: any } | null>(null);

  // Beim Laden: DB-Werte übernehmen.
  useEffect(() => {
    if (design.data) {
      setLayout(mergeLayout(design.data.layout_json));
      setTemplateUrl(design.data.template_url ?? null);
      setTemplateDirty(false);
    }
  }, [design.data]);

  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const sx = VB_W / rect.width;
    const sy = VB_H / rect.height;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  };

  const onPointerDown = (key: ElementKey, mode: "move" | "resize", e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelected(key);
    const p = clientToSvg(e.clientX, e.clientY);
    dragRef.current = { key, mode, startX: p.x, startY: p.y, initial: JSON.parse(JSON.stringify(layout[key])) };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = clientToSvg(e.clientX, e.clientY);
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;
    setLayout((prev) => {
      const next = { ...prev };
      if (d.key === "photo") {
        const init = d.initial as PlayerCardLayout["photo"];
        if (d.mode === "move") {
          next.photo = { ...prev.photo, x: init.x + dx, y: init.y + dy };
        } else {
          next.photo = { ...prev.photo, w: Math.max(50, init.w + dx), h: Math.max(50, init.h + dy) };
        }
      } else {
        const init = d.initial as { x: number; y: number; fontSize?: number };
        (next as any)[d.key] = { ...init, x: init.x + dx, y: init.y + dy };
      }
      return next;
    });
  };

  const onPointerUp = () => { dragRef.current = null; };

  const updateField = (key: ElementKey, field: string, value: number) => {
    setLayout((prev) => ({ ...prev, [key]: { ...(prev as any)[key], [field]: value } }));
  };

  const onTemplateUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Datei zu groß (max. 5 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTemplateUrl(reader.result as string);
      setTemplateDirty(true);
    };
    reader.readAsDataURL(file);
  };

  const save = useMutation({
    mutationFn: async (publish: boolean | undefined) => {
      // Photo-URL nicht speichern — pro Athlet dynamisch aus Profilbild.
      const layoutForSave: PlayerCardLayout = { ...layout, photo: { ...layout.photo, url: null } };
      return await saveFn({
        data: {
          layout_json: layoutForSave as any,
          template_data_url: templateDirty ? templateUrl : undefined,
          publish,
        },
      });
    },
    onSuccess: (_r, publish) => {
      toast.success(publish ? "Design freigegeben" : "Design gespeichert");
      setTemplateDirty(false);
      qc.invalidateQueries({ queryKey: ["player-card-design"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Speichern fehlgeschlagen"),
  });

  const handleReset = () => {
    setLayout(DEFAULT_LAYOUT);
    toast.success("Layout zurückgesetzt (nicht gespeichert)");
  };

  const sel = layout[selected];
  const isPhoto = selected === "photo";
  const isPublished = design.data?.is_published;
  const uploadedAt = design.data?.template_uploaded_at;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <Link to="/coach/player-cards" className="text-xs text-muted-foreground hover:text-bulls-red">← Player Cards</Link>

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-bulls-red">Coach</div>
          <h1 className="font-display text-3xl font-bold">Karten-Design</h1>
          <p className="text-xs text-muted-foreground">
            Lade dein Template-Bild hoch und positioniere die Werte per Drag & Drop. Werte werden pro Spieler automatisch aus den Performance-Tests befüllt.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {isPublished ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Freigegeben
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-300">Entwurf</span>
            )}
            {uploadedAt && <span>Template hochgeladen: {new Date(uploadedAt).toLocaleString("de-DE")}</span>}
            {design.data?.updated_at && <span>· Zuletzt gespeichert: {new Date(design.data.updated_at).toLocaleString("de-DE")}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleReset} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider hover:border-bulls-red disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button onClick={() => save.mutate(undefined)} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider hover:border-bulls-red disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Entwurf speichern
          </button>
          <button onClick={() => save.mutate(true)} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded-full bg-bulls-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Freigeben
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Editor Canvas */}
        <div className="relative mx-auto w-full max-w-[520px]">
          <div style={{ aspectRatio: `${VB_W} / ${VB_H}` }} className="relative">
            <div className="absolute inset-0">
              <PlayerCard data={DEMO_DATA} layout={layout} templateUrl={templateUrl} />
            </div>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="absolute inset-0 h-full w-full touch-none"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {(Object.keys(LABELS) as ElementKey[]).map((key) => {
                const it = layout[key];
                if (key === "photo") {
                  return (
                    <g key={key}>
                      <rect
                        x={it.x} y={it.y}
                        width={(it as any).w} height={(it as any).h}
                        fill="transparent"
                        stroke={selected === key ? "#E10600" : "#ffffff44"}
                        strokeDasharray="6 4"
                        strokeWidth={selected === key ? 4 : 2}
                        style={{ cursor: "move" }}
                        onPointerDown={(e) => onPointerDown(key, "move", e)}
                      />
                      <rect
                        x={it.x + (it as any).w - 30}
                        y={it.y + (it as any).h - 30}
                        width={30} height={30}
                        fill="#E10600"
                        style={{ cursor: "nwse-resize" }}
                        onPointerDown={(e) => onPointerDown(key, "resize", e)}
                      />
                    </g>
                  );
                }
                const li = it as { x: number; y: number; fontSize?: number };
                const fs = li.fontSize ?? 40;
                const w = Math.max(80, fs * 2);
                const h = fs + 20;
                return (
                  <g key={key}>
                    <rect
                      x={li.x - w / 2} y={li.y - h + 8}
                      width={w} height={h}
                      fill={selected === key ? "#E1060033" : "#ffffff11"}
                      stroke={selected === key ? "#E10600" : "#ffffff55"}
                      strokeDasharray="4 3"
                      strokeWidth={selected === key ? 3 : 1.5}
                      style={{ cursor: "move" }}
                      onPointerDown={(e) => onPointerDown(key, "move", e)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Template-Design</div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-2 text-xs hover:border-bulls-red">
              <Upload className="h-3.5 w-3.5" />
              {templateUrl ? "Template ersetzen" : "Template hochladen"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onTemplateUpload(f); }}
              />
            </label>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              Empfohlen: 1023×1537 PNG, max. 5 MB. Wird als Hintergrund für alle Spielerkarten verwendet.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Element</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value as ElementKey)}
              className="w-full rounded-full border border-border bg-background px-3 py-2 text-xs focus:border-bulls-red focus:outline-none"
            >
              {(Object.keys(LABELS) as ElementKey[]).map((k) => (
                <option key={k} value={k}>{LABELS[k]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Position & Größe</div>
            <NumField label="X" value={Math.round(sel.x)} onChange={(v) => updateField(selected, "x", v)} />
            <NumField label="Y" value={Math.round(sel.y)} onChange={(v) => updateField(selected, "y", v)} />
            {isPhoto ? (
              <>
                <NumField label="Breite" value={Math.round((sel as any).w)} onChange={(v) => updateField(selected, "w", v)} />
                <NumField label="Höhe" value={Math.round((sel as any).h)} onChange={(v) => updateField(selected, "h", v)} />
              </>
            ) : (
              <NumField label="Schriftgröße" value={Math.round((sel as any).fontSize ?? 40)} onChange={(v) => updateField(selected, "fontSize", v)} />
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Das Spielerfoto wird bei jedem Athleten automatisch aus seinem Profilbild gezogen — im Editor siehst du nur den Platzhalter-Rahmen.
          </p>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-xs focus:border-bulls-red focus:outline-none"
      />
    </label>
  );
}
