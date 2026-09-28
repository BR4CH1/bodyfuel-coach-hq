import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Type, Copy, Loader2, Save, Wand2, Users, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import {
  parsePartnerNutritionPlan,
  listPartnerPlanClients,
  savePartnerNutritionPlans,
  duplicateAsPartnerPlan,
} from "@/lib/partner-plan.functions";
import { listCustomerNutritionPlans } from "@/lib/coach-plan-history.functions";
import {
  separationIssues,
  toReviewItems,
  buildPersonPlan,
  suggestClient,
  type ParsedPartnerImport,
  type ReviewItem,
} from "@/lib/partner-plan-import.logic";

export const Route = createFileRoute("/coach/partner-plan")({
  validateSearch: (s: Record<string, unknown>) => ({
    client: typeof s.client === "string" ? s.client : "",
  }),
  head: () => ({
    meta: [
      { title: "Partnerplan erstellen — BodyFuel Coach" },
      { name: "description", content: "Ein Ernährungsplan-PDF für zwei Personen importieren und auf zwei Kundenkonten aufteilen." },
      { property: "og:title", content: "Partnerplan erstellen — BodyFuel Coach" },
      { property: "og:description", content: "Gemeinsamer Upload, zwei getrennte Kundenpläne." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppLayout>
      <PartnerPlanPage />
    </AppLayout>
  ),
});

type Tab = "upload" | "text" | "duplicate";
type Done = { plan_a_id: string; plan_b_id: string; shared_meals: number; meals_a: number; meals_b: number; a: string; b: string };

const SLOT_LABEL: Record<string, string> = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snack",
};

const today = () => new Date().toISOString().slice(0, 10);

function PartnerPlanPage() {
  const { supabaseUser, isCoach } = useSession();
  const { client } = Route.useSearch();
  const clientsFn = useServerFn(listPartnerPlanClients);
  const clients = useQuery({
    queryKey: ["partner-plan-clients"],
    queryFn: () => clientsFn(),
    enabled: !!supabaseUser && isCoach,
  });
  const [tab, setTab] = useState<Tab>("upload");
  const [done, setDone] = useState<Done | null>(null);

  if (!supabaseUser) return <p className="text-sm text-muted-foreground">Bitte einloggen.</p>;
  if (!isCoach) return <p className="text-sm text-destructive">Nur für Coaches.</p>;

  const list = clients.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coach · Partnerplan</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Partnerplan erstellen</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ein gemeinsamer Upload — zwei getrennte Kundenpläne. Beide Pläne werden als Entwurf angelegt und
          bleiben verknüpft; individuelle Mengen und Nährwerte werden pro Person gespeichert.
        </p>
      </div>

      {done ? (
        <DoneCard done={done} onReset={() => setDone(null)} />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <TabBtn active={tab === "upload"} onClick={() => setTab("upload")} icon={<Upload className="h-4 w-4" />} label="PDF / Bild" />
            <TabBtn active={tab === "text"} onClick={() => setTab("text")} icon={<Type className="h-4 w-4" />} label="Text einfügen" />
            <TabBtn active={tab === "duplicate"} onClick={() => setTab("duplicate")} icon={<Copy className="h-4 w-4" />} label="Ohne PDF (duplizieren)" />
          </div>
          {tab === "duplicate" ? (
            <DuplicateFlow clients={list} defaultClient={client} onDone={setDone} />
          ) : (
            <ImportFlow key={tab} mode={tab} clients={list} defaultClient={client} onDone={setDone} />
          )}
        </>
      )}
    </div>
  );
}

function DoneCard({ done, onReset }: { done: Done; onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
      <div className="flex items-center gap-2 text-emerald-500">
        <CheckCircle2 className="h-5 w-5" />
        <h2 className="font-display text-lg font-bold text-foreground">Partnerplan angelegt</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {done.a}: {done.meals_a} Mahlzeiten · {done.b}: {done.meals_b} Mahlzeiten · {done.shared_meals} gemeinsame
        Partner-Mahlzeiten verknüpft. Beide Pläne sind Entwürfe — Freigabe wie gewohnt im Kundenprofil.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/coach/plan-preview/$planId" params={{ planId: done.plan_a_id }} className="inline-flex items-center gap-1 rounded-md bg-gradient-gold px-3 py-2 text-sm font-semibold text-primary-foreground">
          Plan {done.a} <ArrowRight className="h-4 w-4" />
        </Link>
        <Link to="/coach/plan-preview/$planId" params={{ planId: done.plan_b_id }} className="inline-flex items-center gap-1 rounded-md bg-gradient-gold px-3 py-2 text-sm font-semibold text-primary-foreground">
          Plan {done.b} <ArrowRight className="h-4 w-4" />
        </Link>
        <button onClick={onReset} className="rounded-md border border-border px-3 py-2 text-sm">Weiteren Partnerplan</button>
      </div>
    </div>
  );
}

function ClientSelect({
  value, onChange, clients, exclude, label,
}: { value: string; onChange: (v: string) => void; clients: { id: string; name: string }[]; exclude?: string; label: string }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
      >
        <option value="">— Kunde wählen —</option>
        {clients.filter((c) => c.id !== exclude).map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </label>
  );
}

function ImportFlow({
  mode, clients, defaultClient, onDone,
}: { mode: "upload" | "text"; clients: { id: string; name: string }[]; defaultClient: string; onDone: (d: Done) => void }) {
  const parseFn = useServerFn(parsePartnerNutritionPlan);
  const saveFn = useServerFn(savePartnerNutritionPlans);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedPartnerImport | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [clientA, setClientA] = useState("");
  const [clientB, setClientB] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [confirmed, setConfirmed] = useState(false);

  const accept = (res: ParsedPartnerImport, fallbackTitle: string) => {
    setParsed(res);
    setItems(toReviewItems(res));
    setTitle(res.title || fallbackTitle);
    const a = suggestClient(res.persons[0]?.name ?? "", clients) ?? (defaultClient || "");
    const b = suggestClient(res.persons[1]?.name ?? "", clients, a) ?? "";
    setClientA(a);
    setClientB(b && b !== a ? b : "");
    setConfirmed(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast.error("Datei zu groß (max. 15 MB)");
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const res = await parseFn({ data: { mode: isPdf ? "pdf" : "image", payload: dataUrl, filename: file.name } });
      accept(res, file.name.replace(/\.(pdf|png|jpe?g|webp)$/i, ""));
      toast.success("Plan gelesen — bitte Zuordnung prüfen.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konnte nicht lesen");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const parseText = async () => {
    if (text.trim().length < 20) return toast.error("Bitte mehr Text einfügen.");
    setBusy(true);
    try {
      accept(await parseFn({ data: { mode: "text", payload: text } }), "Partnerplan");
      toast.success("Plan gelesen — bitte Zuordnung prüfen.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konnte nicht parsen");
    } finally {
      setBusy(false);
    }
  };

  const issues = parsed ? separationIssues(parsed) : [];
  const needsConfirm = issues.length > 0;
  const nameA = clients.find((c) => c.id === clientA)?.name ?? parsed?.persons[0]?.name ?? "Person A";
  const nameB = clients.find((c) => c.id === clientB)?.name ?? parsed?.persons[1]?.name ?? "Person B";
  const count = (p: 0 | 1) => items.filter((i) => i.person === p).length;

  const save = async () => {
    if (!clientA || !clientB) return toast.error("Bitte beide Kunden zuordnen.");
    if (clientA === clientB) return toast.error("Bitte zwei unterschiedliche Kunden wählen.");
    if (needsConfirm && !confirmed) return toast.error("Bitte bestätige, dass du die Zuordnung geprüft hast.");
    if (!count(0) || !count(1)) return toast.error("Jede Person braucht mindestens eine Mahlzeit.");
    setSaving(true);
    try {
      const res = await saveFn({
        data: {
          client_a: clientA,
          client_b: clientB,
          plan_a: buildPersonPlan(items, 0, title),
          plan_b: buildPersonPlan(items, 1, title),
          title,
          start_date: startDate,
          source: mode === "text" ? "text_import" : "pdf_import",
        },
      });
      toast.success("Partnerplan für beide Kunden angelegt.");
      onDone({ ...res, a: nameA, b: nameB });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {mode === "upload" ? (
        <div className="rounded-2xl border border-gold/40 bg-card p-5">
          <h2 className="font-display text-lg font-bold">Ein PDF mit zwei Personen hochladen</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Die KI trennt die Inhalte nach Person. Nährwerte werden danach pro Person aus der Lebensmitteldatenbank berechnet.
          </p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "Lese Plan..." : "Datei wählen"}
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} disabled={busy} />
          </label>
        </div>
      ) : (
        <div className="rounded-2xl border border-gold/40 bg-card p-5">
          <h2 className="font-display text-lg font-bold">Partnerplan als Text einfügen</h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={"Lukas Kiefer\nTag 1\nFrühstück: 100g Haferflocken, 300ml Milch\n...\n\nNina Kiefer\nTag 1\nFrühstück: 60g Haferflocken, 200ml Milch\n..."}
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
          />
          <button onClick={parseText} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Nach Person trennen
          </button>
        </div>
      )}

      {parsed && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gold" />
            <h2 className="font-display text-lg font-bold">Zuordnung prüfen</h2>
          </div>

          {needsConfirm ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-amber-500">
                <AlertTriangle className="h-4 w-4" /> Trennung nicht sicher — nichts wird blind importiert.
              </p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {issues.map((i) => <li key={i}>{i}</li>)}
                {parsed.notes && <li>{parsed.notes}</li>}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Trennung eindeutig erkannt. Bitte trotzdem kurz prüfen.</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Start
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {([0, 1] as const).map((p) => (
              <div key={p} className="rounded-xl border border-gold/30 bg-background/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">
                  Person {p === 0 ? "A" : "B"} · im PDF: „{parsed.persons[p]?.name ?? "—"}"
                </p>
                <div className="mt-2">
                  <ClientSelect
                    label="Kundenkonto"
                    value={p === 0 ? clientA : clientB}
                    onChange={p === 0 ? setClientA : setClientB}
                    clients={clients}
                    exclude={p === 0 ? clientB : clientA}
                  />
                </div>
                <PersonColumn items={items} person={p} nameA={nameA} nameB={nameB} setItems={setItems} />
              </div>
            ))}
          </div>

          {needsConfirm && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4" />
              Ich habe die Zuordnung aller Mahlzeiten geprüft.
            </label>
          )}

          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Für beide als Entwurf anlegen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonColumn({
  items, person, nameA, nameB, setItems,
}: {
  items: ReviewItem[];
  person: 0 | 1;
  nameA: string;
  nameB: string;
  setItems: React.Dispatch<React.SetStateAction<ReviewItem[]>>;
}) {
  const mine = items.filter((i) => i.person === person);
  const days = useMemo(() => {
    const m = new Map<number, ReviewItem[]>();
    for (const i of mine) m.set(i.dayIndex, [...(m.get(i.dayIndex) ?? []), i]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [mine]);
  const move = (ids: string[], to: 0 | 1) =>
    setItems((all) => all.map((i) => (ids.includes(i.id) ? { ...i, person: to } : i)));
  const other: 0 | 1 = person === 0 ? 1 : 0;

  if (!mine.length) return <p className="mt-3 text-xs text-muted-foreground">Keine Mahlzeiten zugeordnet.</p>;
  return (
    <div className="mt-3 space-y-3">
      {days.map(([di, list]) => (
        <div key={di} className="rounded-lg border border-border bg-card p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {list[0].dayName}
              {list[0].dayType && (
                <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                  {list[0].dayType === "training" ? "Trainingstag" : "Ruhetag"}
                </span>
              )}
              {list[0].date && <span className="ml-2 text-[10px] text-muted-foreground">{list[0].date}</span>}
            </p>
            <button onClick={() => move(list.map((i) => i.id), other)} className="text-[11px] text-gold hover:underline">
              Ganzen Tag → {other === 0 ? nameA : nameB}
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {list.map((i) => (
              <li key={i.id} className="rounded-md border border-border bg-background/40 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {SLOT_LABEL[i.meal.slot]}{i.meal.shared ? " · gemeinsam" : ""}
                    </p>
                    <p className="text-sm font-medium break-words">{i.meal.name}</p>
                    <p className="text-[11px] text-muted-foreground break-words">
                      {i.meal.ingredients
                        .map((g) => `${g.name} ${g.grams ?? g.amount ?? "?"}${g.unit === "ml" ? " ml" : " g"}`)
                        .join(", ")}
                    </p>
                  </div>
                  <select
                    value={i.person}
                    onChange={(e) => move([i.id], (Number(e.target.value) === 1 ? 1 : 0) as 0 | 1)}
                    className="shrink-0 rounded-md border border-input bg-background px-1.5 py-1 text-xs"
                    aria-label="Person zuordnen"
                  >
                    <option value={0}>{nameA}</option>
                    <option value={1}>{nameB}</option>
                  </select>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function DuplicateFlow({
  clients, defaultClient, onDone,
}: { clients: { id: string; name: string }[]; defaultClient: string; onDone: (d: Done) => void }) {
  const listPlansFn = useServerFn(listCustomerNutritionPlans);
  const dupFn = useServerFn(duplicateAsPartnerPlan);
  const [clientA, setClientA] = useState(defaultClient);
  const [clientB, setClientB] = useState("");
  const [planId, setPlanId] = useState("");
  const [factor, setFactor] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const plans = useQuery({
    queryKey: ["coach-nutrition-plans", clientA],
    queryFn: () => listPlansFn({ data: { client_id: clientA } }),
    enabled: !!clientA,
  });
  const options = (plans.data?.all ?? []).filter((p) => p.status !== "archived");

  const save = async () => {
    if (!clientA || !clientB || !planId) return toast.error("Bitte beide Kunden und einen Quellplan wählen.");
    setSaving(true);
    try {
      const f = parseFloat(factor.replace(",", "."));
      const res = await dupFn({
        data: { source_plan_id: planId, client_b: clientB, factor: Number.isFinite(f) ? f : null, start_date: startDate },
      });
      toast.success(`Partnerplan angelegt (Portionsfaktor ${String(res.factor).replace(".", ",")}).`);
      onDone({
        ...res,
        a: clients.find((c) => c.id === clientA)?.name ?? "Person A",
        b: clients.find((c) => c.id === clientB)?.name ?? "Person B",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-gold/40 bg-card p-5">
      <h2 className="font-display text-lg font-bold">Partnerplan aus bestehendem Plan</h2>
      <p className="text-xs text-muted-foreground">
        Der Plan von Person A dient als Vorlage. Für Person B werden alle Zutatenmengen mit dem Portionsfaktor skaliert
        (leer = automatisch aus den Kalorienzielen beider Kunden). Der Quellplan bleibt unverändert; beide Pläne entstehen neu als Entwurf.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ClientSelect label="Person A (Vorlage)" value={clientA} onChange={(v) => { setClientA(v); setPlanId(""); }} clients={clients} exclude={clientB} />
        <ClientSelect label="Person B (Partner)" value={clientB} onChange={setClientB} clients={clients} exclude={clientA} />
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-muted-foreground">Quellplan</span>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} disabled={!clientA || plans.isLoading} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm">
            <option value="">{plans.isLoading ? "Lade…" : "— Plan wählen —"}</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.title || "Ohne Titel") + (p.scheduled_start_date ? ` — ${p.scheduled_start_date}` : "")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-muted-foreground">Portionsfaktor Person B (optional)</span>
          <input inputMode="decimal" value={factor} onChange={(e) => setFactor(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="z. B. 0,8" className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm" />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-muted-foreground">Startdatum</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm" />
        </label>
      </div>
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          Partnerplan erstellen
        </button>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
        active ? "border-gold/60 bg-gold/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-gold/40"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
