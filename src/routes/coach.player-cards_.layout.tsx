/**
 * Player Card — Interaktiver Layout-Editor.
 *
 * Alle Overlay-Elemente (Zahlen, Labels) und das Spielerbild lassen sich per
 * Drag & Drop verschieben. Größe der Textelemente über die Sidebar. Speicherung
 * lokal im Browser (localStorage) — dient als Design-Werkzeug für die Karte.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { PlayerCard } from "@/components/player-cards/PlayerCard";
import {
  DEFAULT_LAYOUT,
  VB_H,
  VB_W,
  loadLayout,
  resetLayout,
  saveLayout,
  type PlayerCardLayout,
} from "@/lib/player-cards/layout";
import { RotateCcw, Save, Upload } from "lucide-react";
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
  photo: "Spielerfoto",
};

// Demo-Daten für die Vorschau
const DEMO_DATA: any = {
  card: {
    bfr: 83, spd: 72, acc: 75, agi: 80, pow: 85, str: 80, end_score: 70,
    tier: "GOLD", is_provisional: false, position_key: "QUARTERBACK",
    strongest_attribute: "POW", computed_at: new Date().toISOString(),
    manual_overrides: {}, is_published: true,
  },
  profile: { display_name: "Demo Spieler", nickname: null, avatar_url: null, birthdate: "2000-01-01", height_cm: 193, sport_position: "QUARTERBACK" },
  bullsProfile: { first_name: "Demo", last_name: "Spieler", weight_kg: 95, height_cm: 193, position: "QUARTERBACK" },
  organization: null,
  jerseyNumber: "12",
};

function LayoutEditorPage() {
  const [layout, setLayout] = useState<PlayerCardLayout>(DEFAULT_LAYOUT);
  const [selected, setSelected] = useState<ElementKey>("ovr");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ key: ElementKey; mode: "move" | "resize"; startX: number; startY: number; initial: any } | null>(null);

  useEffect(() => {
    setLayout(loadLayout());
  }, []);

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
          next.photo = {
            ...prev.photo,
            w: Math.max(50, init.w + dx),
            h: Math.max(50, init.h + dy),
          };
        }
      } else {
        const init = d.initial as { x: number; y: number; fontSize?: number };
        (next as any)[d.key] = { ...init, x: init.x + dx, y: init.y + dy };
      }
      return next;
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const updateField = (key: ElementKey, field: string, value: number) => {
    setLayout((prev) => ({ ...prev, [key]: { ...(prev as any)[key], [field]: value } }));
  };

  const onPhotoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setLayout((prev) => ({ ...prev, photo: { ...prev.photo, url: reader.result as string } }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    saveLayout(layout);
    toast.success("Layout gespeichert");
  };
  const handleReset = () => {
    resetLayout();
    setLayout(DEFAULT_LAYOUT);
    toast.success("Layout zurückgesetzt");
  };

  const sel = layout[selected];
  const isPhoto = selected === "photo";

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <Link to="/coach/player-cards" className="text-xs text-muted-foreground hover:text-bulls-red">← Player Cards</Link>

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-bulls-red">Coach</div>
          <h1 className="font-display text-3xl font-bold">Layout Editor</h1>
          <p className="text-xs text-muted-foreground">
            Ziehe Elemente auf der Karte an ihre Position. Größe & Feinjustierung rechts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider hover:border-bulls-red">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button onClick={handleSave} className="inline-flex items-center gap-1.5 rounded-full bg-bulls-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90">
            <Save className="h-3.5 w-3.5" /> Speichern
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Editor Canvas */}
        <div className="relative mx-auto w-full max-w-[520px]">
          <div style={{ aspectRatio: `${VB_W} / ${VB_H}` }} className="relative">
            {/* Rendered card (baseline) */}
            <div className="absolute inset-0">
              <PlayerCard data={DEMO_DATA} layout={layout} />
            </div>
            {/* Interactive overlay SVG */}
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
                      {/* Resize handle */}
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

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Spielerfoto</div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-2 text-xs hover:border-bulls-red">
              <Upload className="h-3.5 w-3.5" />
              Foto hochladen
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPhotoUpload(f);
                }}
              />
            </label>
            {layout.photo.url && (
              <button
                onClick={() => setLayout((p) => ({ ...p, photo: { ...p.photo, url: null } }))}
                className="ml-2 text-xs text-muted-foreground underline"
              >
                Entfernen
              </button>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Tipp: Klick auf ein Feld in der Karte → mit Drag verschieben. Für Fotos den roten Griff unten rechts zum Skalieren nutzen.
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
