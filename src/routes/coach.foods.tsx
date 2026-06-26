import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertTriangle, Plus, Search, Trash2 } from "lucide-react";

export const Route = createFileRoute("/coach/foods")({
  component: CoachFoodsPage,
});

type Food = {
  id: string;
  name: string;
  aliases: string[];
  category: string | null;
  source: string;
  source_id: string | null;
  source_name: string | null;
  license: string | null;
  citation: string | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number | null;
  sugar_per_100g: number | null;
  salt_per_100g: number | null;
  unit_type: "raw" | "cooked" | "ml" | "piece";
  default_state: "raw" | "cooked" | "n_a";
  density_g_per_ml: number | null;
  verified_by_coach: boolean;
  needs_review: boolean;
  review_reason: string | null;
  notes: string | null;
  updated_at: string;
};

const SOURCES = [
  { value: "bls_4_0", label: "BLS 4.0 (MRI)" },
  { value: "open_food_facts", label: "Open Food Facts" },
  { value: "usda", label: "USDA FDC" },
  { value: "bodyfuel_verified", label: "BodyFuel verified" },
  { value: "manual", label: "Manuell" },
  { value: "ai_estimate", label: "KI-Schätzung" },
];

const emptyFood = (): Partial<Food> => ({
  name: "",
  aliases: [],
  category: "",
  source: "bodyfuel_verified",
  kcal_per_100g: 0,
  protein_per_100g: 0,
  carbs_per_100g: 0,
  fat_per_100g: 0,
  unit_type: "raw",
  default_state: "raw",
  verified_by_coach: true,
});

function CoachFoodsPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "review" | "verified" | "unverified">("all");
  const [editing, setEditing] = useState<Partial<Food> | null>(null);
  const [saving, setSaving] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  async function recomputeAll() {
    if (recomputing) return;
    if (!confirm("Alle aktiven & Draft-Pläne anhand der Lebensmittel-DB nachrechnen?")) return;
    setRecomputing(true);
    try {
      const { recomputeAllPlanMacros } = await import("@/lib/nutrition-backfill.functions");
      const res = await recomputeAllPlanMacros();
      toast.success(
        `Fertig: ${res.updated}/${res.scanned} Mahlzeiten korrigiert (${res.db_recomputed} aus DB neu, ${res.kcal_fixed} kcal-konsistent).`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Nachrechnen");
    } finally {
      setRecomputing(false);
    }
  }

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase.from("nutrition_foods" as any) as any)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setFoods((data as Food[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods.filter((f) => {
      if (filter === "review" && !f.needs_review) return false;
      if (filter === "verified" && !f.verified_by_coach) return false;
      if (filter === "unverified" && f.verified_by_coach) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        (f.category ?? "").toLowerCase().includes(q) ||
        (f.aliases ?? []).some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [foods, query, filter]);

  async function save() {
    if (!editing) return;
    if (!editing.name?.trim()) { toast.error("Name fehlt"); return; }
    if (!editing.kcal_per_100g || editing.kcal_per_100g <= 0) {
      toast.error("kcal/100g muss > 0 sein"); return;
    }
    setSaving(true);
    const payload: any = {
      name: editing.name.trim(),
      aliases: editing.aliases ?? [],
      category: editing.category || null,
      source: editing.source ?? "manual",
      source_id: editing.source_id || null,
      source_name: editing.source_name || null,
      license: editing.license || null,
      citation: editing.citation || null,
      kcal_per_100g: Number(editing.kcal_per_100g),
      protein_per_100g: Number(editing.protein_per_100g) || 0,
      carbs_per_100g: Number(editing.carbs_per_100g) || 0,
      fat_per_100g: Number(editing.fat_per_100g) || 0,
      fiber_per_100g: editing.fiber_per_100g == null ? null : Number(editing.fiber_per_100g),
      sugar_per_100g: editing.sugar_per_100g == null ? null : Number(editing.sugar_per_100g),
      salt_per_100g: editing.salt_per_100g == null ? null : Number(editing.salt_per_100g),
      unit_type: editing.unit_type ?? "raw",
      default_state: editing.default_state ?? "raw",
      density_g_per_ml: editing.density_g_per_ml == null ? null : Number(editing.density_g_per_ml),
      verified_by_coach: !!editing.verified_by_coach,
      notes: editing.notes || null,
    };
    const table = supabase.from("nutrition_foods" as any) as any;
    const res = editing.id
      ? await table.update(payload).eq("id", editing.id)
      : await table.insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Gespeichert");
    setEditing(null);
    void load();
  }

  async function del(id: string) {
    if (!confirm("Lebensmittel wirklich löschen?")) return;
    const { error } = await (supabase.from("nutrition_foods" as any) as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Gelöscht");
    void load();
  }

  async function toggleVerified(f: Food) {
    const { error } = await (supabase.from("nutrition_foods" as any) as any)
      .update({ verified_by_coach: !f.verified_by_coach })
      .eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    void load();
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/coach" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Coach-Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={recomputeAll} disabled={recomputing}>
            {recomputing ? "Rechne neu…" : "Pläne nachrechnen"}
          </Button>
          <Button onClick={() => setEditing(emptyFood())}>
            <Plus className="mr-1 h-4 w-4" /> Neues Lebensmittel
          </Button>
        </div>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold">Lebensmittel-Datenbank</h1>
        <p className="text-sm text-muted-foreground">
          Geprüfte Nährwerte für BodyFuel. Quellen: BLS 4.0 (Max Rubner-Institut, CC BY 4.0),
          Open Food Facts, USDA FDC. Coach-verifizierte Werte haben Vorrang.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Name, Kategorie, Alias…"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="review">Nur „prüfen"</SelectItem>
            <SelectItem value="verified">Nur verifiziert</SelectItem>
            <SelectItem value="unverified">Nur unverifiziert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-12 gap-2 border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground">
          <div className="col-span-4">Name</div>
          <div className="col-span-2">Quelle</div>
          <div className="col-span-1 text-right">kcal</div>
          <div className="col-span-1 text-right">P</div>
          <div className="col-span-1 text-right">K</div>
          <div className="col-span-1 text-right">F</div>
          <div className="col-span-2 text-right">Aktion</div>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Lade…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            Noch keine Einträge. Lege das erste Lebensmittel an.
          </div>
        ) : (
          filtered.map((f) => (
            <div key={f.id} className="grid grid-cols-12 items-center gap-2 border-b border-border/60 px-4 py-2 text-sm last:border-0">
              <div className="col-span-4">
                <button
                  className="text-left font-medium hover:underline"
                  onClick={() => setEditing(f)}
                >
                  {f.name}
                </button>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {f.verified_by_coach && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <CheckCircle2 className="h-3 w-3" /> verifiziert
                    </Badge>
                  )}
                  {f.needs_review && (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <AlertTriangle className="h-3 w-3" /> prüfen
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">{f.unit_type}</Badge>
                  {f.default_state !== "n_a" && (
                    <Badge variant="outline" className="text-[10px]">{f.default_state}</Badge>
                  )}
                  {f.category && <span className="text-[10px] text-muted-foreground">{f.category}</span>}
                </div>
                {f.needs_review && f.review_reason && (
                  <div className="pt-0.5 text-[10px] text-destructive">{f.review_reason}</div>
                )}
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">
                {SOURCES.find((s) => s.value === f.source)?.label ?? f.source}
              </div>
              <div className="col-span-1 text-right tabular-nums">{Math.round(f.kcal_per_100g)}</div>
              <div className="col-span-1 text-right tabular-nums">{Number(f.protein_per_100g).toFixed(1)}</div>
              <div className="col-span-1 text-right tabular-nums">{Number(f.carbs_per_100g).toFixed(1)}</div>
              <div className="col-span-1 text-right tabular-nums">{Number(f.fat_per_100g).toFixed(1)}</div>
              <div className="col-span-2 flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => toggleVerified(f)}>
                  {f.verified_by_coach ? "Unverif." : "Verif."}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => del(f.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Lebensmittel bearbeiten" : "Neues Lebensmittel"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label>Kategorie</Label>
                  <Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                </div>
                <div>
                  <Label>Aliase (Komma)</Label>
                  <Input
                    value={(editing.aliases ?? []).join(", ")}
                    onChange={(e) => setEditing({
                      ...editing,
                      aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })}
                  />
                </div>
                <div>
                  <Label>Quelle</Label>
                  <Select value={editing.source ?? "manual"} onValueChange={(v) => setEditing({ ...editing, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quelle ID</Label>
                  <Input value={editing.source_id ?? ""} onChange={(e) => setEditing({ ...editing, source_id: e.target.value })} />
                </div>
                <div>
                  <Label>Einheit</Label>
                  <Select value={editing.unit_type ?? "raw"} onValueChange={(v) => setEditing({ ...editing, unit_type: v as Food["unit_type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw">roh (g)</SelectItem>
                      <SelectItem value="cooked">gekocht (g)</SelectItem>
                      <SelectItem value="ml">Flüssigkeit (ml)</SelectItem>
                      <SelectItem value="piece">Stück</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Zustand (Standard)</Label>
                  <Select value={editing.default_state ?? "raw"} onValueChange={(v) => setEditing({ ...editing, default_state: v as Food["default_state"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw">roh</SelectItem>
                      <SelectItem value="cooked">gekocht</SelectItem>
                      <SelectItem value="n_a">k.A.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <NumField label="kcal/100g" value={editing.kcal_per_100g} onChange={(v) => setEditing({ ...editing, kcal_per_100g: v ?? 0 })} />
                <NumField label="Protein g" value={editing.protein_per_100g} onChange={(v) => setEditing({ ...editing, protein_per_100g: v ?? 0 })} />
                <NumField label="KH g" value={editing.carbs_per_100g} onChange={(v) => setEditing({ ...editing, carbs_per_100g: v ?? 0 })} />
                <NumField label="Fett g" value={editing.fat_per_100g} onChange={(v) => setEditing({ ...editing, fat_per_100g: v ?? 0 })} />
                <NumField label="Ballast." value={editing.fiber_per_100g ?? undefined} onChange={(v) => setEditing({ ...editing, fiber_per_100g: v })} />
                <NumField label="Zucker" value={editing.sugar_per_100g ?? undefined} onChange={(v) => setEditing({ ...editing, sugar_per_100g: v })} />
                <NumField label="Salz" value={editing.salt_per_100g ?? undefined} onChange={(v) => setEditing({ ...editing, salt_per_100g: v })} />
                <NumField label="Dichte g/ml" value={editing.density_g_per_ml ?? undefined} onChange={(v) => setEditing({ ...editing, density_g_per_ml: v })} step="0.001" />
              </div>

              <KcalCheck editing={editing} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quelle Name</Label>
                  <Input value={editing.source_name ?? ""} onChange={(e) => setEditing({ ...editing, source_name: e.target.value })} placeholder="z.B. Max Rubner-Institut" />
                </div>
                <div>
                  <Label>Lizenz</Label>
                  <Input value={editing.license ?? ""} onChange={(e) => setEditing({ ...editing, license: e.target.value })} placeholder="z.B. CC BY 4.0" />
                </div>
                <div className="col-span-2">
                  <Label>Zitation</Label>
                  <Input value={editing.citation ?? ""} onChange={(e) => setEditing({ ...editing, citation: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Notizen</Label>
                  <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editing.verified_by_coach}
                  onChange={(e) => setEditing({ ...editing, verified_by_coach: e.target.checked })}
                />
                Als <strong>BodyFuel-verifiziert</strong> markieren (hat Vorrang vor API-Werten)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NumField({
  label, value, onChange, step,
}: {
  label: string; value: number | null | undefined; onChange: (v: number | null) => void; step?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step ?? "0.1"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </div>
  );
}

function KcalCheck({ editing }: { editing: Partial<Food> }) {
  const p = Number(editing.protein_per_100g) || 0;
  const c = Number(editing.carbs_per_100g) || 0;
  const f = Number(editing.fat_per_100g) || 0;
  const kcal = Number(editing.kcal_per_100g) || 0;
  if (!kcal) return null;
  const calc = p * 4 + c * 4 + f * 9;
  const diff = Math.abs(calc - kcal) / kcal;
  const ok = diff <= 0.05;
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" : "border-destructive/40 bg-destructive/5 text-destructive"}`}>
      Makro-Check: {Math.round(calc)} kcal aus Makros vs. {Math.round(kcal)} kcal gespeichert
      {" — "}{ok ? "OK" : `Abweichung ${Math.round(diff * 100)}% (muss ≤ 5 %)`}
    </div>
  );
}
