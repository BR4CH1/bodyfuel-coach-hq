import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import {
  getCustomerDetail,
  updateCustomerPackage,
  updateCustomerCoachingInfo,
  confirmPayment,
  resendInvite,
  sendPasswordReset,
  setCustomerActive,
  setCustomerPassword,
  deleteCustomer,
} from "@/lib/coaching.functions";
import { setUserGroup } from "@/lib/admin-groups.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CoachTrainingSummary } from "@/components/bodyfuel/TrainingTrends";
import { NutritionTargetsEditor } from "@/components/bodyfuel/NutritionTargetsEditor";
import { MacroTargetsCard } from "@/components/bodyfuel/MacroTargetsCard";
import { TrainingBonusCard } from "@/components/bodyfuel/TrainingBonusCard";
import { CustomerRecentActivityCard } from "@/components/bodyfuel/CustomerRecentActivityCard";
import { CoachTrialCard } from "@/components/bodyfuel/CoachTrialCard";
import { RecipeInsightsCard } from "@/components/bodyfuel/RecipeInsightsCard";
import { SmartNutritionInsightsCard } from "@/components/bodyfuel/SmartNutritionInsightsCard";



export const Route = createFileRoute("/coach/customers/$userId")({
  head: () => ({ meta: [{ title: "Kunde — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <CustomerDetail />
    </AppLayout>
  ),
});

function CustomerDetail() {
  const { userId } = useParams({ from: "/coach/customers/$userId" });
  const navigate = useNavigate();
  const getFn = useServerFn(getCustomerDetail);
  const updFn = useServerFn(updateCustomerPackage);
  const payFn = useServerFn(confirmPayment);
  const inviteFn = useServerFn(resendInvite);
  const resetFn = useServerFn(sendPasswordReset);
  const activeFn = useServerFn(setCustomerActive);
  const setPwFn = useServerFn(setCustomerPassword);
  const deleteFn = useServerFn(deleteCustomer);
  const coachingFn = useServerFn(updateCustomerCoachingInfo);
  const groupFn = useServerFn(setUserGroup);
  const qc = useQueryClient();

  const [newPw, setNewPw] = useState("");
  const [showPwForm, setShowPwForm] = useState(false);


  const { data, isLoading } = useQuery({
    queryKey: ["customer", userId],
    queryFn: () => getFn({ data: { user_id: userId } }),
  });

  const activePkg = data?.packages.find((p) => p.is_active) ?? data?.packages[0];

  const [price, setPrice] = useState<number>(0);
  const [pkgKey, setPkgKey] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [coachingGoal, setCoachingGoal] = useState<string>("");
  const [nextCheckin, setNextCheckin] = useState<string>("");

  useEffect(() => {
    if (activePkg) {
      setPrice(Number(activePkg.price_eur));
      setPkgKey(activePkg.package);
      setStartDate(activePkg.start_date ?? "");
      setEndDate(activePkg.end_date);
    }
  }, [activePkg]);

  useEffect(() => {
    if (data) {
      setCoachingGoal((data as any).coaching_goal ?? "");
      setNextCheckin((data as any).next_checkin_date ?? "");
    }
  }, [data]);

  const saveCoaching = useMutation({
    mutationFn: () =>
      coachingFn({
        data: {
          user_id: userId,
          coaching_goal: coachingGoal || null,
          next_checkin_date: nextCheckin || null,
        },
      }),
    onSuccess: () => {
      toast.success("Coaching-Infos gespeichert.");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const update = useMutation({
    mutationFn: (patch: Parameters<typeof updFn>[0]["data"]) =>
      updFn({ data: patch }),
    onSuccess: () => {
      toast.success("Gespeichert.");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: (payment_id: string) => payFn({ data: { payment_id, extend_days: 30 } }),
    onSuccess: () => {
      toast.success("Zahlung bestätigt, Laufzeit verlängert.");
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accessAction = useMutation({
    mutationFn: async (action: "invite" | "reset" | "deactivate" | "activate") => {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      if (action === "invite") return inviteFn({ data: { user_id: userId, origin } });
      if (action === "reset") return resetFn({ data: { user_id: userId, origin } });
      return activeFn({ data: { user_id: userId, active: action === "activate" } });
    },
    onSuccess: (_d, action) => {
      const m = {
        invite: "Einladung erneut versendet.",
        reset: "Passwort-Reset-Mail versendet.",
        activate: "Zugang aktiviert.",
        deactivate: "Zugang deaktiviert.",
      } as const;
      toast.success(m[action]);
      qc.invalidateQueries({ queryKey: ["customer", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Lade…</p>;

  const status = data.auth?.status ?? "invited";
  const statusLabel =
    status === "active" ? "Aktiv" : status === "deactivated" ? "Deaktiviert" : "Einladung offen";
  const statusClass =
    status === "active"
      ? "bg-gold/10 text-gold"
      : status === "deactivated"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/20 text-warning";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Kunde</p>
        <h1 className="font-display text-3xl font-bold">
          {data.profile?.display_name ?? data.email}
        </h1>
        <p className="text-sm text-muted-foreground">{data.email}</p>
        {data.profile?.phone && (
          <p className="text-sm text-muted-foreground">{data.profile.phone}</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Zugang</h2>
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
        <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
          {data.auth?.invited_at && (
            <div>Eingeladen am: {new Date(data.auth.invited_at).toLocaleDateString("de-DE")}</div>
          )}
          {(data.auth as any)?.last_activity_at ? (
            <div>Letzte Aktivität: {new Date((data.auth as any).last_activity_at).toLocaleString("de-DE")}</div>
          ) : data.auth?.last_sign_in_at && (
            <div>Letzte Aktivität: {new Date(data.auth.last_sign_in_at).toLocaleString("de-DE")}</div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => accessAction.mutate("invite")}
            disabled={accessAction.isPending}
            className="bg-gradient-gold text-primary-foreground"
          >
            {status === "invited" ? "Einladung erneut senden" : "Einladung senden"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => accessAction.mutate("reset")}
            disabled={accessAction.isPending}
          >
            Passwort zurücksetzen
          </Button>
          {status === "deactivated" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => accessAction.mutate("activate")}
              disabled={accessAction.isPending}
            >
              Zugang aktivieren
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm("Zugang wirklich deaktivieren? Der Kunde kann sich nicht mehr einloggen.")) {
                  accessAction.mutate("deactivate");
                }
              }}
              disabled={accessAction.isPending}
              className="text-destructive hover:text-destructive"
            >
              Zugang deaktivieren
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPwForm((v) => !v)}
          >
            Passwort selbst setzen
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const name = data.profile?.display_name ?? data.email ?? "diesen Kunden";
              if (!window.confirm(`Konto von ${name} unwiderruflich löschen? Alle Pakete und Zahlungen werden ebenfalls entfernt.`)) return;
              try {
                await deleteFn({ data: { user_id: userId } });
                toast.success("Kunde gelöscht.");
                navigate({ to: "/coach/customers" });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            className="text-destructive hover:text-destructive"
          >
            Konto löschen
          </Button>
        </div>

        {showPwForm && (
          <form
            className="mt-4 flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (newPw.length < 8) return toast.error("Mindestens 8 Zeichen.");
              try {
                await setPwFn({ data: { user_id: userId, password: newPw } });
                toast.success("Passwort gesetzt.");
                setNewPw("");
                setShowPwForm(false);
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="manual-pw">Neues Passwort</Label>
              <Input
                id="manual-pw"
                type="text"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Mind. 8 Zeichen"
                className="w-56"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" size="sm" className="bg-gradient-gold text-primary-foreground">
              Speichern
            </Button>
          </form>
        )}
      </div>

      <CoachTrialCard userId={userId} />

      <GroupsCard
        userId={userId}
        groups={(data as any).groups ?? []}
        onToggle={async (group, enabled) => {
          try {
            await groupFn({ data: { user_id: userId, group, enabled } });
            toast.success(enabled ? "Zugang aktiviert." : "Zugang entfernt.");
            qc.invalidateQueries({ queryKey: ["customer", userId] });
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      {activePkg && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">Aktives Paket</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Paket</Label>
              <select
                value={pkgKey}
                onChange={(e) => setPkgKey(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="starter">Starter</option>
                <option value="coaching">Coaching</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Preis (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Startdatum</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Vertragsbeginn — auch in der Zukunft möglich (z.B. 01.07.).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Ablaufdatum</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                update.mutate({
                  package_id: activePkg.id,
                  package: pkgKey as "starter" | "coaching" | "premium",
                  price_eur: price,
                  start_date: startDate || undefined,
                  end_date: endDate,
                })
              }
              className="bg-gradient-gold text-primary-foreground"
            >
              Speichern
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                update.mutate({
                  package_id: activePkg.id,
                  is_active: !activePkg.is_active,
                })
              }
            >
              {activePkg.is_active ? "Deaktivieren" : "Aktivieren"}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Coaching-Infos</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Diese Werte werden im Kundenprofil angezeigt — der Kunde kann sie nicht ändern.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Ziel</Label>
            <Select value={coachingGoal} onValueChange={setCoachingGoal}>
              <SelectTrigger>
                <SelectValue placeholder="Ziel wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="abnehmen">Abnehmen</SelectItem>
                <SelectItem value="muskelaufbau">Muskelaufbau</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nächster Check-in</Label>
            <Input
              type="date"
              value={nextCheckin}
              onChange={(e) => setNextCheckin(e.target.value)}
            />
          </div>
        </div>
        <Button
          onClick={() => saveCoaching.mutate()}
          disabled={saveCoaching.isPending}
          className="mt-4 bg-gradient-gold text-primary-foreground"
        >
          Speichern
        </Button>
      </div>



      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Zahlungshistorie</h2>
        {data.payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Noch keine Zahlungen.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2">Datum</th>
                <th>Betrag</th>
                <th>Methode</th>
                <th>Status</th>
                <th>Notiz</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">{p.payment_date}</td>
                  <td>{Number(p.amount_eur).toFixed(2)} €</td>
                  <td>{p.method}</td>
                  <td>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " +
                        (p.status === "confirmed"
                          ? "bg-gold/10 text-gold"
                          : p.status === "pending"
                            ? "bg-warning/20 text-warning"
                            : "bg-muted text-muted-foreground")
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{p.note ?? "—"}</td>
                  <td className="text-right">
                    {p.status === "pending" && (
                      <Button size="sm" onClick={() => confirm.mutate(p.id)}>
                        Bestätigen
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CustomerRecentActivityCard userId={userId} />

      <MeasurementsCard measurements={data.measurements ?? []} />

      <MacroTargetsCard userId={userId} />
      <NutritionTargetsEditor userId={userId} />
      <SmartNutritionInsightsCard userId={userId} />
      <RecipeInsightsCard userId={userId} />
      <TrainingBonusCard userId={userId} isCoach />
      <CoachTrainingSummary clientId={userId} />
    </div>
  );
}

function MeasurementsCard({ measurements }: { measurements: any[] }) {
  const [showAll, setShowAll] = useState(false);
  if (!measurements.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Maße & Gewicht</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Noch keine Maße erfasst.
        </p>
      </div>
    );
  }
  const latest = measurements[0];
  const visible = showAll ? measurements : measurements.slice(0, 5);
  const fmt = (v: any, unit: string) =>
    v == null || v === "" ? "—" : `${Number(v).toLocaleString("de-DE")} ${unit}`;
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Maße & Gewicht</h2>
        <span className="text-xs text-muted-foreground">
          Aktuell: {new Date(latest.measured_at).toLocaleDateString("de-DE")}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Gewicht" value={fmt(latest.weight_kg, "kg")} />
        <Stat label="Körperfett" value={fmt(latest.body_fat_pct, "%")} />
        <Stat label="Muskelmasse" value={fmt(latest.muscle_mass_kg, "kg")} />
        <Stat label="Taille" value={fmt(latest.waist_cm, "cm")} />
        <Stat label="Brust" value={fmt(latest.chest_cm, "cm")} />
        <Stat label="Oberschenkel L" value={fmt(latest.thigh_left_cm, "cm")} />
        <Stat label="Oberschenkel R" value={fmt(latest.thigh_right_cm, "cm")} />
        <Stat label="Bizeps L" value={fmt(latest.biceps_left_cm, "cm")} />
        <Stat label="Bizeps R" value={fmt(latest.biceps_right_cm, "cm")} />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2">Datum</th>
              <th>Gewicht</th>
              <th>KFA</th>
              <th>Muskel</th>
              <th>Taille</th>
              <th>Brust</th>
              <th>OS L</th>
              <th>OS R</th>
              <th>Bi L</th>
              <th>Bi R</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="py-2">
                  {new Date(m.measured_at).toLocaleDateString("de-DE")}
                </td>
                <td>{fmt(m.weight_kg, "kg")}</td>
                <td>{fmt(m.body_fat_pct, "%")}</td>
                <td>{fmt(m.muscle_mass_kg, "kg")}</td>
                <td>{fmt(m.waist_cm, "cm")}</td>
                <td>{fmt(m.chest_cm, "cm")}</td>
                <td>{fmt(m.thigh_left_cm, "cm")}</td>
                <td>{fmt(m.thigh_right_cm, "cm")}</td>
                <td>{fmt(m.biceps_left_cm, "cm")}</td>
                <td>{fmt(m.biceps_right_cm, "cm")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {measurements.length > 5 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-xs font-semibold uppercase tracking-wider text-gold hover:underline"
        >
          {showAll ? "Weniger anzeigen" : `Alle ${measurements.length} anzeigen`}
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-lg font-bold">{value}</div>
    </div>
  );
}

type GroupKey = "bulls" | "running_team" | "sgz" | "premium";

function GroupsCard({
  groups,
  onToggle,
}: {
  userId: string;
  groups: string[];
  onToggle: (group: GroupKey, enabled: boolean) => void;
}) {
  const items: { key: GroupKey; label: string; desc: string }[] = [
    {
      key: "bulls",
      label: "Bulls-Mitglied",
      desc: "Zugriff auf den kostenlosen Bulls Performance Hub.",
    },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-bold">Gruppen & Zugänge</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Schalter sind unabhängig voneinander — ein Nutzer kann mehrere Zugänge gleichzeitig haben.
      </p>
      <div className="mt-4 space-y-2">
        {items.map((it) => {
          const enabled = groups.includes(it.key);
          return (
            <label
              key={it.key}
              className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onToggle(it.key, e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <div>
                <div className="text-sm font-semibold">{it.label}</div>
                <div className="text-xs text-muted-foreground">{it.desc}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}



