import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Copy, Gift, Loader2, Trash2 } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGiftCode,
  deleteGiftCode,
  listGiftCodes,
  listGiftHubs,
} from "@/lib/smart-gifts.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/coach/gifts")({
  head: () => ({ meta: [{ title: "Smart-Geschenklinks — Coach" }, { name: "robots", content: "noindex" }] }),
  component: CoachGiftsPage,
});

function CoachGiftsPage() {
  const { isCoach, loading } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listGiftCodes);
  const create = useServerFn(createGiftCode);
  const remove = useServerFn(deleteGiftCode);

  const [label, setLabel] = useState("");
  const [days, setDays] = useState(30);
  const [maxUses, setMaxUses] = useState(1);
  const [expires, setExpires] = useState("");

  const { data: codes, isLoading } = useQuery({
    queryKey: ["smart-gift-codes"],
    queryFn: () => list(),
    enabled: !loading && isCoach,
  });

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          label: label.trim() || undefined,
          days,
          max_uses: maxUses,
          expires_at: expires ? new Date(expires).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Geschenk-Code erstellt");
      setLabel("");
      qc.invalidateQueries({ queryKey: ["smart-gift-codes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => remove({ data: { code } }),
    onSuccess: () => {
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["smart-gift-codes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  if (!loading && !isCoach) {
    navigate({ to: "/" });
    return null;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("In Zwischenablage kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <Link to="/coach" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-gold" /> Smart-Geschenklinks
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Erstelle Links für Freunde & Influencer. Empfänger registrieren sich selbst und erhalten kostenlos das BodyFuel Smart-Paket für die gewählte Dauer.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold mb-4">Neuen Code erstellen</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="label">Bezeichnung (optional)</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="z. B. Lisa Influencer Q1"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="days">Dauer (Tage)</Label>
            <Input
              id="days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 30))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max_uses">Anzahl Einlösungen</Label>
            <Input
              id="max_uses"
              type="number"
              min={1}
              max={10000}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="expires">Code läuft ab (optional)</Label>
            <Input
              id="expires"
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
        </div>
        <Button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          className="mt-4 bg-gradient-gold text-primary-foreground hover:opacity-90"
        >
          {createMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
          Code erstellen
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold mb-4">Aktive Codes</h2>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Lädt…</div>
        ) : !codes || codes.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Noch keine Codes erstellt.</div>
        ) : (
          <ul className="space-y-3">
            {codes.map((c: any) => {
              const link = `${origin}/smart/gift/${c.code}`;
              const exhausted = c.uses >= c.max_uses;
              const expired = c.expires_at && new Date(c.expires_at).getTime() < Date.now();
              return (
                <li key={c.code} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm font-bold">{c.code}</code>
                        {c.label && <span className="text-sm text-muted-foreground truncate">{c.label}</span>}
                        {exhausted && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">Verbraucht</span>}
                        {expired && <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] uppercase tracking-wide">Abgelaufen</span>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.days} Tage · {c.uses}/{c.max_uses} eingelöst
                        {c.expires_at ? ` · gültig bis ${new Date(c.expires_at).toLocaleDateString("de-DE")}` : ""}
                      </div>
                      <div className="mt-1 break-all text-xs text-muted-foreground">{link}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copy(link)}>
                        <Copy className="mr-1 h-3 w-3" /> Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm(`Code ${c.code} wirklich löschen?`)) deleteMut.mutate(c.code);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
