import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Copy, Link2, Plus, Trash2, Users, Wallet, CheckCircle2, XCircle } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  listAffiliatePartners,
  listAffiliateReferrals,
  createAffiliatePartner,
  updateAffiliatePartner,
  deleteAffiliatePartner,
  markReferralPaid,
  voidReferral,
} from "@/lib/affiliates.functions";

export const Route = createFileRoute("/coach/affiliates")({
  head: () => ({ meta: [{ title: "Affiliate Partner — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <AffiliatesPage />
    </AppLayout>
  ),
});

function AffiliatesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAffiliatePartners);
  const refsFn = useServerFn(listAffiliateReferrals);
  const createFn = useServerFn(createAffiliatePartner);
  const updateFn = useServerFn(updateAffiliatePartner);
  const deleteFn = useServerFn(deleteAffiliatePartner);
  const payFn = useServerFn(markReferralPaid);
  const voidFn = useServerFn(voidReferral);

  const { data: partners, isLoading } = useQuery({ queryKey: ["affiliate-partners"], queryFn: () => listFn() });
  const { data: referrals } = useQuery({ queryKey: ["affiliate-referrals"], queryFn: () => refsFn() });

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"payable" | "paid" | "all">("payable");

  const totalPayable = (partners ?? []).reduce((s, p: any) => s + (p.stats?.payable_eur ?? 0), 0);
  const totalPaid = (partners ?? []).reduce((s, p: any) => s + (p.stats?.paid_eur ?? 0), 0);
  const totalSignups = (partners ?? []).reduce((s, p: any) => s + (p.stats?.signups ?? 0), 0);

  const filteredRefs = (referrals ?? []).filter((r: any) => filter === "all" || r.commission_status === filter);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["affiliate-partners"] });
    qc.invalidateQueries({ queryKey: ["affiliate-referrals"] });
  };

  const submitNew = async (form: { name: string; email: string; slug: string; commission_pct: number; notes: string; discount_code: string }) => {
    try {
      await createFn({
        data: {
          ...form,
          email: form.email || undefined,
          notes: form.notes || undefined,
          discount_code: form.discount_code || undefined,
        },
      });
      toast.success("Partner angelegt");
      setOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Link to="/coach" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Coach
          </Link>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Affiliate Partner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Partner werben Neukunden. Standard 10% Provision auf die Erstzahlung (außer Smart-Geschenke).
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-gradient-gold text-primary-foreground">
          <Plus className="mr-1 h-4 w-4" /> Neuer Partner
        </Button>
      </div>

      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi icon={<Users className="h-4 w-4" />} label="Aktive Partner" value={(partners ?? []).filter((p: any) => p.is_active).length} />
        <Kpi icon={<Wallet className="h-4 w-4 text-gold" />} label="Offen auszuzahlen" value={`${totalPayable.toFixed(2)} €`} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Bereits ausgezahlt" value={`${totalPaid.toFixed(2)} €`} />
      </div>

      {/* Partners */}
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Partner ({(partners ?? []).length})</h2>
        {isLoading && <p className="text-sm text-muted-foreground">Lade…</p>}
        {!isLoading && (partners ?? []).length === 0 && (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Noch keine Partner. Lege deinen ersten Partner an, kopiere den Referral-Link und gib ihn weiter.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {(partners ?? []).map((p: any) => (
            <PartnerCard
              key={p.id}
              p={p}
              onUpdate={async (patch) => {
                try {
                  await updateFn({ data: { id: p.id, patch } });
                  refresh();
                } catch (e: any) {
                  toast.error(e?.message ?? "Fehler");
                }
              }}
              onDelete={async () => {
                if (!confirm(`Partner "${p.name}" wirklich löschen? (Bestehende Provisionen bleiben erhalten? Nein — diese werden ebenfalls gelöscht.)`)) return;
                try {
                  await deleteFn({ data: { id: p.id } });
                  toast.success("Gelöscht");
                  refresh();
                } catch (e: any) {
                  toast.error(e?.message ?? "Fehler");
                }
              }}
            />
          ))}
        </div>
      </section>

      {/* Commissions */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Provisionen ({filteredRefs.length} / {(referrals ?? []).length}) · gesamt {totalSignups} Signups
          </h2>
          <div className="flex gap-1">
            {(["payable", "paid", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={
                  "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider " +
                  (filter === f ? "border-gold bg-gold/15 text-gold" : "border-border text-muted-foreground")
                }
              >
                {f === "payable" ? "Offen" : f === "paid" ? "Ausgezahlt" : "Alle"}
              </button>
            ))}
          </div>
        </div>
        {filteredRefs.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Keine Einträge.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">Partner</th>
                  <th className="px-4 py-3">Kunde</th>
                  <th className="px-4 py-3">Zahlung</th>
                  <th className="px-4 py-3">Provision</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRefs.map((r: any) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("de-DE")}</td>
                    <td className="px-4 py-3 font-semibold">
                      {r.partner_name ?? "—"}{" "}
                      {r.partner_slug && <span className="ml-1 text-[10px] font-mono text-muted-foreground">@{r.partner_slug}</span>}
                    </td>
                    <td className="px-4 py-3">{r.customer_name ?? "—"}</td>
                    <td className="px-4 py-3">{r.payment_amount_eur != null ? `${Number(r.payment_amount_eur).toFixed(2)} €` : "—"}</td>
                    <td className="px-4 py-3 font-display text-gold">
                      {r.commission_amount_eur != null ? `${Number(r.commission_amount_eur).toFixed(2)} €` : "—"}
                      {r.commission_pct != null && <span className="ml-1 text-[10px] text-muted-foreground">({Number(r.commission_pct)}%)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.commission_status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.commission_status === "payable" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const note = prompt("Auszahlungs-Notiz (optional)") ?? "";
                              try {
                                await payFn({ data: { id: r.id, note: note || undefined } });
                                toast.success("Als ausgezahlt markiert");
                                refresh();
                              } catch (e: any) {
                                toast.error(e?.message ?? "Fehler");
                              }
                            }}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Bezahlt
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              const reason = prompt("Grund für Stornierung") ?? "";
                              if (!reason) return;
                              try {
                                await voidFn({ data: { id: r.id, reason } });
                                refresh();
                              } catch (e: any) {
                                toast.error(e?.message ?? "Fehler");
                              }
                            }}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Hint */}
      <p className="rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground">
        Automatische Auszahlung über Stripe Connect kommt in Phase 2. Bis dahin überweist du manuell und markierst die Provision als „Bezahlt".
      </p>

      <NewPartnerDialog open={open} onOpenChange={setOpen} onSubmit={submitNew} />
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    pending: { label: "Wartet auf Zahlung", cls: "bg-muted text-muted-foreground" },
    payable: { label: "Offen", cls: "bg-gold/15 text-gold border border-gold/40" },
    paid: { label: "Ausgezahlt", cls: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40" },
    void: { label: "Storniert", cls: "bg-destructive/15 text-destructive border border-destructive/40" },
  };
  const c = cfg[status] ?? cfg.pending;
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${c.cls}`}>{c.label}</span>;
}

function PartnerCard({
  p,
  onUpdate,
  onDelete,
}: {
  p: any;
  onUpdate: (patch: any) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://bodyfuel-coaching.com";
  const url = `${origin}/?ref=${p.slug}`;
  const promoUrl = p.discount_code ? `${origin}/smart/signup?promo=${p.discount_code}` : null;
  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };
  const [editPct, setEditPct] = useState(false);
  const [pct, setPct] = useState<number>(Number(p.commission_pct));
  const [editCode, setEditCode] = useState(false);
  const [code, setCode] = useState<string>(p.discount_code ?? "");

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-lg font-bold">{p.name}</h3>
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">@{p.slug}</span>
          </div>
          {p.email && <p className="truncate text-xs text-muted-foreground">{p.email}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={p.is_active} onCheckedChange={(v) => onUpdate({ is_active: v })} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-border bg-background/30 p-2">
          <div className="text-muted-foreground">Signups</div>
          <div className="font-display text-lg">{p.stats?.signups ?? 0}</div>
        </div>
        <div className="rounded-xl border border-border bg-background/30 p-2">
          <div className="text-muted-foreground">Konvertiert</div>
          <div className="font-display text-lg">{p.stats?.converted ?? 0}</div>
        </div>
        <div className="rounded-xl border border-gold/40 bg-gold/10 p-2">
          <div className="text-gold">Offen</div>
          <div className="font-display text-lg text-gold">{Number(p.stats?.payable_eur ?? 0).toFixed(2)} €</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 truncate rounded-lg border border-border bg-background/50 px-2 py-1.5 text-xs text-muted-foreground">
          <Link2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{url}</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => copy(url, "Link kopiert")}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>

      {/* Rabattcode */}
      <div className="mt-2 rounded-lg border border-gold/30 bg-gold/5 p-2 text-xs">
        {editCode ? (
          <div className="flex items-center gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24))}
              placeholder="MARCEL10"
              className="h-7 uppercase tracking-wider"
            />
            <Button
              size="sm"
              onClick={async () => {
                await onUpdate({ discount_code: code.trim() ? code.trim() : null });
                setEditCode(false);
              }}
            >
              Speichern
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCode(p.discount_code ?? ""); setEditCode(false); }}>
              Abbrechen
            </Button>
          </div>
        ) : p.discount_code ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-gold">Rabattcode ({Number(p.discount_pct ?? p.commission_pct)}%)</div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="rounded bg-gold/15 px-1.5 py-0.5 font-mono font-bold text-gold">{p.discount_code}</span>
                <button
                  onClick={() => copy(p.discount_code, "Code kopiert")}
                  className="text-muted-foreground hover:text-foreground"
                  title="Code kopieren"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {promoUrl && (
                  <button
                    onClick={() => copy(promoUrl, "Direktlink kopiert")}
                    className="truncate text-muted-foreground hover:text-foreground"
                    title="Direktlink kopieren"
                  >
                    <Link2 className="mr-0.5 inline h-3 w-3" />
                    Direktlink
                  </button>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditCode(true)} className="text-muted-foreground">
              Ändern
            </Button>
          </div>
        ) : (
          <button onClick={() => setEditCode(true)} className="w-full text-left text-muted-foreground hover:text-foreground">
            <Tag className="mr-1 inline h-3 w-3" /> Rabattcode hinzufügen
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {editPct ? (
            <>
              <Input
                type="number"
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="h-7 w-20"
                min={0}
                max={100}
                step={0.5}
              />
              <Button
                size="sm"
                onClick={async () => {
                  await onUpdate({ commission_pct: pct });
                  setEditPct(false);
                }}
              >
                Speichern
              </Button>
            </>
          ) : (
            <button onClick={() => setEditPct(true)} className="text-muted-foreground hover:text-foreground">
              Provision: <span className="font-display text-gold">{Number(p.commission_pct)}%</span>
            </button>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function NewPartnerDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: { name: string; email: string; slug: string; commission_pct: number; notes: string; discount_code: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [pct, setPct] = useState(10);
  const [notes, setNotes] = useState("");
  const [discountCode, setDiscountCode] = useState("");

  const autoSlug = (v: string) =>
    v
      .trim()
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

  const autoCode = (v: string) =>
    v
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]+/g, "")
      .slice(0, 24);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuer Partner</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim() || !slug.trim()) return toast.error("Name & Slug erforderlich");
            await onSubmit({
              name: name.trim(),
              email: email.trim(),
              slug: slug.trim(),
              commission_pct: pct,
              notes: notes.trim(),
              discount_code: discountCode.trim(),
            });
            setName(""); setEmail(""); setSlug(""); setPct(10); setNotes(""); setDiscountCode("");
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(autoSlug(e.target.value));
                if (!discountCode) {
                  const auto = autoCode(e.target.value.replace(/\s+/g, "") + String(pct));
                  if (auto.length >= 3) setDiscountCode(auto);
                }
              }}
              placeholder="Max Mustermann"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>E-Mail (optional)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="partner@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Link-Kürzel (Slug)</Label>
            <Input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} placeholder="max-2026" required />
            <p className="text-[10px] text-muted-foreground">Wird zu: /?ref={slug || "slug"}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Provision & Rabatt (%)</Label>
            <Input
              type="number"
              value={pct}
              min={0}
              max={100}
              step={0.5}
              onChange={(e) => setPct(Number(e.target.value))}
            />
            <p className="text-[10px] text-muted-foreground">
              Partner erhält {pct}% Provision · Kunde spart {pct}% auf den 1. Smart-Monat.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Rabattcode (optional)</Label>
            <Input
              value={discountCode}
              onChange={(e) => setDiscountCode(autoCode(e.target.value))}
              placeholder="z. B. MARCEL10"
              className="uppercase tracking-wider"
              maxLength={24}
            />
            <p className="text-[10px] text-muted-foreground">
              Kunde tippt den Code im Checkout ein oder öffnet /smart/signup?promo={discountCode || "CODE"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z.B. Studio Altenessen" />
          </div>
          <Button type="submit" className="w-full bg-gradient-gold text-primary-foreground">
            Anlegen
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
