import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Users, UserPlus, UserMinus, Sparkles, Loader2 } from "lucide-react";
import {
  listLinkablePartners,
  getPartnerLink,
  linkPartner,
  unlinkPartner,
} from "@/lib/partner.functions";
import { generatePartnerNutritionPlanDraft } from "@/lib/partner-nutrition-plan-ai.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function PartnerLinkCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const linkFn = useServerFn(getPartnerLink);
  const listFn = useServerFn(listLinkablePartners);
  const setLink = useServerFn(linkPartner);
  const unsetLink = useServerFn(unlinkPartner);
  const genFn = useServerFn(generatePartnerNutritionPlanDraft);

  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string>("");
  const [shared, setShared] = useState({
    breakfast: false,
    lunch: false,
    dinner: true,
    snack: false,
  });
  const [durationMode, setDurationMode] = useState<"shopping" | "fixed">("shopping");
  const [fixedDays, setFixedDays] = useState<string>("7");

  const link = useQuery({
    queryKey: ["partner-link", userId],
    queryFn: () => linkFn({ data: { user_id: userId } }),
  });

  const candidates = useQuery({
    queryKey: ["partner-candidates", userId],
    queryFn: () => listFn({ data: { user_id: userId } }),
    enabled: picking,
  });

  const save = useMutation({
    mutationFn: (partnerId: string) =>
      setLink({ data: { user_a: userId, user_b: partnerId } }),
    onSuccess: () => {
      toast.success("Partner verknüpft.");
      setPicking(false);
      setChosen("");
      qc.invalidateQueries({ queryKey: ["partner-link", userId] });
      qc.invalidateQueries({ queryKey: ["partner-candidates", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const remove = useMutation({
    mutationFn: () => unsetLink({ data: { user_id: userId } }),
    onSuccess: () => {
      toast.success("Partner entfernt.");
      qc.invalidateQueries({ queryKey: ["partner-link", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const generate = useMutation({
    mutationFn: (start_mode: "today" | "next_shopping") => {
      const planDays =
        durationMode === "fixed"
          ? Math.max(1, Math.min(21, parseInt(fixedDays, 10) || 7))
          : null;
      return genFn({
        data: {
          user_a: userId,
          user_b: link.data?.partner_id!,
          start_mode,
          shared_slots: shared,
          plan_days: planDays,
        },
      });
    },
    onSuccess: () => {
      toast.success("Gemeinsamer Plan-Entwurf erstellt (für beide Personen).");
      qc.invalidateQueries({ queryKey: ["plan-overview", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const partner = link.data;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-gold" />
        <h2 className="font-display text-lg font-bold">Partner-Modus</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Koppele zwei Kunden, wenn sie häufig zusammen essen. Die KI plant
        gleiche Gerichte mit individuellen Mengen und Makros.
      </p>

      {link.isLoading && <p className="mt-3 text-sm text-muted-foreground">Lade…</p>}

      {!link.isLoading && !partner && !picking && (
        <Button
          onClick={() => setPicking(true)}
          className="mt-4 bg-gradient-gold text-primary-foreground"
        >
          <UserPlus className="mr-2 h-4 w-4" /> 👥 Partner verknüpfen
        </Button>
      )}

      {!link.isLoading && !partner && picking && (
        <div className="mt-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Partner auswählen
          </div>
          <Select value={chosen} onValueChange={setChosen}>
            <SelectTrigger>
              <SelectValue placeholder={candidates.isLoading ? "Lade…" : "Kunde wählen"} />
            </SelectTrigger>
            <SelectContent>
              {(candidates.data ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              {!candidates.isLoading && !(candidates.data ?? []).length && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Keine freien Kunden — andere sind bereits gekoppelt.
                </div>
              )}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!chosen || save.isPending}
              onClick={() => save.mutate(chosen)}
              className="bg-gradient-gold text-primary-foreground"
            >
              Verknüpfen
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPicking(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {partner && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Partner-Modus aktiv
            </div>
            <div className="mt-1 font-display text-base font-bold">
              Verknüpft mit: {partner.partner_name}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gemeinsame Mahlzeiten
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(["breakfast", "lunch", "dinner", "snack"] as const).map((slot) => (
                <label key={slot} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={shared[slot]}
                    onChange={(e) => setShared((s) => ({ ...s, [slot]: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  {slot === "breakfast"
                    ? "Frühstück"
                    : slot === "lunch"
                      ? "Mittagessen"
                      : slot === "dinner"
                        ? "Abendessen"
                        : "Snacks"}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-background/40 px-4 py-3 text-xs">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">
              Dauer
            </span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`partner-duration-${userId}`}
                className="h-3.5 w-3.5 accent-current"
                checked={durationMode === "shopping"}
                onChange={() => setDurationMode("shopping")}
              />
              <span>Bis nächster Einkaufstag</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`partner-duration-${userId}`}
                className="h-3.5 w-3.5 accent-current"
                checked={durationMode === "fixed"}
                onChange={() => setDurationMode("fixed")}
              />
              <span>Feste Dauer:</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={fixedDays}
                onFocus={() => setDurationMode("fixed")}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                  setFixedDays(raw);
                }}
                onBlur={() => {
                  const num = Math.max(1, Math.min(21, parseInt(fixedDays, 10) || 7));
                  setFixedDays(String(num));
                }}
                className="w-14 rounded-md border border-input bg-background px-2 py-1 text-xs"
              />
              <span>Tage</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => generate.mutate("today")}
              disabled={generate.isPending}
              className="bg-gradient-gold text-primary-foreground"
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Erstelle…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Gemeinsamen Plan (ab heute)
                </>
              )}
            </Button>
            <Button
              onClick={() => generate.mutate("next_shopping")}
              disabled={generate.isPending}
              variant="outline"
            >
              <Sparkles className="mr-2 h-4 w-4" /> Ab nächstem Einkauf
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                remove.mutate(undefined as any);
                setTimeout(() => setPicking(true), 200);
              }}
            >
              Partner ändern
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Partner-Kopplung wirklich entfernen?")) remove.mutate(undefined as any);
              }}
              className="text-destructive hover:text-destructive"
            >
              <UserMinus className="mr-2 h-4 w-4" /> Partner entfernen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
