import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Sparkles, Check } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getMySmartProfile, saveSmartProfile } from "@/lib/smart-profile.functions";

export const Route = createFileRoute("/onboarding/smart-nutrition")({
  head: () => ({ meta: [{ title: "Dein Profil — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <Wizard />
    </AppLayout>
  ),
});

const FAVORITES = [
  "Hähnchen", "Rind", "Pute", "Eier", "Skyr", "Reis", "Nudeln", "Kartoffeln",
  "Wraps", "Haferflocken", "Obst", "Gemüse", "Fisch", "Käse", "Nüsse", "Proteinpulver",
];
const ALLERGY_OPTS = ["Laktose", "Gluten", "Nüsse", "Soja", "Ei", "Fisch", "Meeresfrüchte"];
const PREP_STYLES = [
  { v: "daily", l: "Ich koche gerne täglich" },
  { v: "2_3_week", l: "2–3x pro Woche kochen" },
  { v: "meal_prep", l: "Meal Prep für mehrere Tage" },
  { v: "low_effort", l: "Möglichst wenig Aufwand" },
] as const;
const SHOPPING_DAYS = [
  { v: "monday", l: "Montag" }, { v: "tuesday", l: "Dienstag" },
  { v: "wednesday", l: "Mittwoch" }, { v: "thursday", l: "Donnerstag" },
  { v: "friday", l: "Freitag" }, { v: "saturday", l: "Samstag" },
  { v: "sunday", l: "Sonntag" },
] as const;
const TRAINING_DAYS = SHOPPING_DAYS;

const BUDGETS = [
  { v: "<50", l: "Unter 50 €" },
  { v: "50_75", l: "50–75 €" },
  { v: "75_100", l: "75–100 €" },
  { v: ">100", l: "Über 100 €" },
] as const;

function Wizard() {
  const navigate = useNavigate();
  const getFn = useServerFn(getMySmartProfile);
  const saveFn = useServerFn(saveSmartProfile);
  const { data: existing, isLoading } = useQuery({
    queryKey: ["smart-profile-me"],
    queryFn: () => getFn(),
  });

  const [step, setStep] = useState(0);
  const [favs, setFavs] = useState<string[]>([]);
  const [extraFav, setExtraFav] = useState("");
  const [nogos, setNogos] = useState<string[]>([]);
  const [extraNogo, setExtraNogo] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [extraAllergy, setExtraAllergy] = useState("");
  const [prep, setPrep] = useState<string>("");
  const [shopDays, setShopDays] = useState<string[]>([]);
  const [leadDays, setLeadDays] = useState(1);
  const [budget, setBudget] = useState<string>("");

  useEffect(() => {
    if (existing) {
      setFavs(existing.favorite_foods ?? []);
      setExtraFav(existing.extra_favorites ?? "");
      setNogos(existing.nogo_foods ?? []);
      setExtraNogo(existing.extra_nogos ?? "");
      setAllergies(existing.allergies ?? []);
      setExtraAllergy(existing.extra_allergies ?? "");
      setPrep(existing.meal_prep_style ?? "");
      setShopDays(existing.shopping_days?.length ? existing.shopping_days : (existing.shopping_day ? [existing.shopping_day] : []));
      setLeadDays(existing.shopping_lead_days ?? 1);
      setBudget(existing.budget_band ?? "");
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: (complete: boolean) =>
      saveFn({
        data: {
          favorite_foods: favs,
          nogo_foods: nogos,
          allergies,
          extra_favorites: extraFav || null,
          extra_nogos: extraNogo || null,
          extra_allergies: extraAllergy || null,
          meal_prep_style: prep as any || null,
          shopping_day: (shopDays[0] as any) || null,
          shopping_days: shopDays,
          shopping_lead_days: leadDays,
          budget_band: budget as any || null,
          complete,
        },
      }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Lade…</p>;

  const STEPS = 6;
  const last = step === STEPS;

  const toggle = (list: string[], set: (l: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Smart Nutrition</p>
        <h1 className="font-display text-2xl font-bold">
          Lass uns deinen Ernährungsplan noch besser machen 💚
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Maximal 60 Sekunden — du kannst alles später ändern.
        </p>
      </div>

      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-gradient-gold transition-all"
          style={{ width: `${((step + 1) / (STEPS + 1)) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        {step === 0 && (
          <StepBlock title="Welche Lebensmittel isst du besonders gerne?" sub="Mehrfachauswahl">
            <ChipGrid options={FAVORITES} value={favs} onToggle={(v) => toggle(favs, setFavs, v)} />
            <Input
              placeholder="Weitere Lebensmittel"
              value={extraFav}
              onChange={(e) => setExtraFav(e.target.value)}
              className="mt-3"
            />
          </StepBlock>
        )}
        {step === 1 && (
          <StepBlock title="Welche Lebensmittel möchtest du niemals essen?" sub="No-Go's — wir planen sie nie ein">
            <ChipGrid options={FAVORITES} value={nogos} onToggle={(v) => toggle(nogos, setNogos, v)} />
            <Textarea
              placeholder="Weitere No-Go's (kommagetrennt)"
              value={extraNogo}
              onChange={(e) => setExtraNogo(e.target.value)}
              className="mt-3"
              rows={2}
            />
          </StepBlock>
        )}
        {step === 2 && (
          <StepBlock title="Gibt es Allergien oder Unverträglichkeiten?" sub="Höchste Priorität — wird strikt ausgeschlossen">
            <ChipGrid options={ALLERGY_OPTS} value={allergies} onToggle={(v) => toggle(allergies, setAllergies, v)} />
            <Textarea
              placeholder="Weitere Allergien"
              value={extraAllergy}
              onChange={(e) => setExtraAllergy(e.target.value)}
              className="mt-3"
              rows={2}
            />
          </StepBlock>
        )}
        {step === 3 && (
          <StepBlock title="Wie möchtest du deine Mahlzeiten vorbereiten?" sub="Beeinflusst die Rezeptauswahl">
            <RadioList
              options={PREP_STYLES.map((p) => ({ v: p.v, l: p.l }))}
              value={prep}
              onChange={setPrep}
            />
          </StepBlock>
        )}
        {step === 4 && (
          <StepBlock title="Wann kaufst du normalerweise ein?" sub="Mehrfachauswahl möglich — Plan & Einkaufsliste passen sich an">
            <ChipGrid
              options={SHOPPING_DAYS.map((d) => d.l)}
              value={shopDays.map((v) => SHOPPING_DAYS.find((d) => d.v === v)?.l ?? v)}
              onToggle={(label) => {
                const opt = SHOPPING_DAYS.find((d) => d.l === label);
                if (!opt) return;
                toggle(shopDays, setShopDays, opt.v);
              }}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Wir bauen deinen Plan automatisch so, dass er bis zum nächsten Einkaufstag reicht.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm">Einkaufsliste</span>
              <select
                value={leadDays}
                onChange={(e) => setLeadDays(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={0}>am gleichen Tag</option>
                <option value={1}>1 Tag vorher</option>
                <option value={2}>2 Tage vorher</option>
              </select>
              <span className="text-sm">erhalten</span>
            </div>
          </StepBlock>
        )}
        {step === 5 && (
          <StepBlock title="Wochenbudget für Lebensmittel?" sub="Hilft uns, passende Rezepte zu wählen">
            <RadioList
              options={BUDGETS.map((b) => ({ v: b.v, l: b.l }))}
              value={budget}
              onChange={setBudget}
            />
          </StepBlock>
        )}
        {last && (
          <div className="text-center py-6 space-y-3">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-gold text-primary-foreground">
              <Check className="h-7 w-7" />
            </div>
            <h2 className="font-display text-xl font-bold">Danke!</h2>
            <p className="text-sm text-muted-foreground">
              Deine Angaben wurden gespeichert. BodyFuel kann deine Ernährungspläne jetzt
              deutlich besser an deinen Alltag und deine Vorlieben anpassen.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || save.isPending}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Zurück
        </Button>
        {!last ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate({ to: "/nutrition" })}
              disabled={save.isPending}
            >
              Später
            </Button>
            <Button
              onClick={() => setStep((s) => s + 1)}
              className="bg-gradient-gold text-primary-foreground"
            >
              Weiter <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            onClick={async () => {
              try {
                await save.mutateAsync(true);
                toast.success("Profil gespeichert!");
                navigate({ to: "/nutrition" });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            disabled={save.isPending}
            className="bg-gradient-gold text-primary-foreground"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Fertig
          </Button>
        )}
      </div>
    </div>
  );
}

function StepBlock({
  title, sub, children,
}: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function ChipGrid({
  options, value, onToggle,
}: { options: string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              on
                ? "border-gold bg-gradient-gold text-primary-foreground"
                : "border-border bg-secondary/30 hover:border-gold/50"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function RadioList({
  options, value, onChange,
}: { options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition ${
              on
                ? "border-gold bg-gold/10"
                : "border-border bg-secondary/30 hover:border-gold/50"
            }`}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}
