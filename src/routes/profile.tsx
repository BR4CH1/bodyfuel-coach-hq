import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  User as UserIcon,
  Mail,
  Calendar,
  Flame,
  Trophy,
  Target,
  Package,
  Bell,
  LogOut,
  KeyRound,
  CalendarCheck,
  Save,
  RefreshCcw,
  ArrowLeftRight,
  MessageSquare,
  Check,
  Sparkles,
  TrendingUp,
  Ruler,
  Camera,
  ChevronRight,
} from "lucide-react";
import {
  createPackageRequest,
  listMyPackageRequests,
} from "@/lib/coaching.functions";
import {
  PACKAGES,
  PACKAGE_LABEL,
  getPackage,
  type PackageKey,
} from "@/lib/bodyfuel/packages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { getMyAthleteProfile } from "@/lib/athlete-profile.functions";
import { AthleteProfileEditor } from "@/components/bodyfuel/AthleteProfileEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profil — BODYFUEL" }] }),
  component: () => (
    <AppLayout>
      <ProfileContent />
    </AppLayout>
  ),
});

const PKG_LABEL = PACKAGE_LABEL;


type ProfileRow = {
  display_name: string | null;
  created_at: string;
  coaching_goal: string | null;
  checkin_reminder: boolean;
  notifications_enabled: boolean;
  next_checkin_date: string | null;
};

type Points = {
  total_points: number;
  level: number;
  current_streak: number;
};

type Pkg = {
  package: string;
  start_date: string;
  end_date: string;
  price_eur: number | string;
  is_active: boolean;
};


function ProfileContent() {
  const navigate = useNavigate();
  const { supabaseUser, logout } = useSession();
  const uid = supabaseUser?.id;

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [points, setPoints] = useState<Points | null>(null);
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Account edit state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const [p, up, cp] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "display_name, created_at, coaching_goal, checkin_reminder, notifications_enabled, next_checkin_date",
          )
          .eq("id", uid)
          .maybeSingle(),
        supabase
          .from("user_points")
          .select("total_points, level, current_streak")
          .eq("user_id", uid)
          .maybeSingle(),
        supabase
          .from("customer_packages")
          .select("package, start_date, end_date, price_eur, is_active")
          .eq("user_id", uid)
          .eq("is_active", true)
          .order("end_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (p.data) setProfile(p.data as ProfileRow);
      if (up.data) setPoints(up.data as Points);
      if (cp.data) setPkg(cp.data as Pkg);
      setLoading(false);
    })();
  }, [uid]);

  const updateProfile = async (patch: Partial<ProfileRow>) => {
    if (!uid || !profile) return;
    const next = { ...profile, ...patch };
    setProfile(next);
    const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
    if (error) toast.error(error.message);
  };

  const saveCoaching = async () => {
    if (!profile) return;
    setSaving(true);
    await updateProfile({
      coaching_goal: profile.coaching_goal,
      next_checkin_date: profile.next_checkin_date,
    });
    setSaving(false);
    toast.success("Coaching-Infos gespeichert");
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Mindestens 6 Zeichen");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else {
      toast.success("Passwort aktualisiert");
      setNewPassword("");
    }
  };

  const changeEmail = async () => {
    if (!newEmail) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) toast.error(error.message);
    else toast.success("Bestätigungs-Mail wurde versendet");
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Lade Profil …</div>;
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-gold">Mein Konto</div>
        <h1 className="mt-1 font-display text-3xl font-bold">Profil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deine Daten, dein Coaching und dein Account – alles an einem Ort.
        </p>
      </header>

      {/* Kundendaten */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Kundendaten</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Info icon={<UserIcon className="h-4 w-4" />} label="Name" value={profile?.display_name ?? "—"} />
          <Info icon={<Mail className="h-4 w-4" />} label="E-Mail" value={supabaseUser?.email ?? "—"} />
          <Info icon={<Calendar className="h-4 w-4" />} label="Mitglied seit" value={memberSince} />
          <Info
            icon={<Trophy className="h-4 w-4" />}
            label="Aktuelles Level"
            value={`Level ${points?.level ?? 1}`}
          />
          <Info
            icon={<Target className="h-4 w-4" />}
            label="Punkte"
            value={`${points?.total_points ?? 0} Pkt`}
          />
          <Info
            icon={<Flame className="h-4 w-4" />}
            label="Streak"
            value={`${points?.current_streak ?? 0} Tage`}
          />
        </div>
        <div className="mt-4 rounded-xl border border-gold/30 bg-gradient-to-r from-gold/10 to-transparent p-4">
          <div className="text-xs uppercase tracking-wider text-gold">Dein Coach</div>
          <div className="mt-1 font-display text-lg font-bold">Manu von BodyFuel</div>
        </div>
      </section>

      {/* Mein Paket */}
      <MyPackageSection pkg={pkg} />

      {/* Coaching-Infos */}

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Coaching-Infos</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ziel und Check-in werden von deinem Coach festgelegt.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Info
            icon={<Target className="h-4 w-4" />}
            label="Ziel"
            value={
              profile?.coaching_goal
                ? profile.coaching_goal === "abnehmen"
                  ? "Abnehmen"
                  : profile.coaching_goal === "muskelaufbau"
                    ? "Muskelaufbau"
                    : profile.coaching_goal === "performance"
                      ? "Performance"
                      : profile.coaching_goal
                : "Noch nicht festgelegt"
            }
          />
          <Info
            icon={<CalendarCheck className="h-4 w-4" />}
            label="Nächster Check-in"
            value={
              profile?.next_checkin_date
                ? new Date(profile.next_checkin_date).toLocaleDateString("de-DE")
                : "Noch nicht festgelegt"
            }
          />
          <Info
            icon={<Package className="h-4 w-4" />}
            label="Aktuelles Paket"
            value={
              pkg
                ? `${PKG_LABEL[pkg.package as PackageKey] ?? pkg.package} (bis ${pkg.end_date})`
                : "Kein aktives Paket"
            }
          />
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <CalendarCheck className="h-4 w-4" /> Check-in Erinnerung
              </div>
              <Switch
                checked={profile?.checkin_reminder ?? true}
                onCheckedChange={(v) => updateProfile({ checkin_reminder: v })}
              />
            </div>
          </div>
        </div>
      </section>


      {/* Athleten- / Sportprofil (Self-Service) */}
      <section id="athlete-profile" className="scroll-mt-20">
        <AthleteSelfSection />
      </section>

      {/* Account */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Account</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-pw">Passwort ändern</Label>
            <div className="flex gap-2">
              <Input
                id="new-pw"
                type="password"
                placeholder="Neues Passwort"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button onClick={changePassword} variant="secondary">
                <KeyRound className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-mail">E-Mail ändern</Label>
            <div className="flex gap-2">
              <Input
                id="new-mail"
                type="email"
                placeholder="neue@email.de"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Button onClick={changeEmail} variant="secondary">
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Bell className="h-4 w-4" /> Benachrichtigungen
            </div>
            <Switch
              checked={profile?.notifications_enabled ?? true}
              onCheckedChange={(v) => updateProfile({ notifications_enabled: v })}
            />
          </div>
        </div>

        <Button
          onClick={async () => {
            await logout();
            navigate({ to: "/login" });
          }}
          variant="destructive"
          className="mt-4"
        >
          <LogOut className="mr-1 h-4 w-4" />
          Logout
        </Button>
      </section>
    </div>
  );
}

function AthleteSelfSection() {
  const getFn = useServerFn(getMyAthleteProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["my-athlete-profile"],
    queryFn: () => getFn(),
  });
  if (isLoading) return null;
  return (
    <AthleteProfileEditor
      mode="self"
      initial={{
        sport: (data as any)?.sport ?? null,
        sport_position: (data as any)?.sport_position ?? null,
        sport_level: (data as any)?.sport_level ?? null,
        team_sport: (data as any)?.team_sport ?? false,
        match_days_per_week: (data as any)?.match_days_per_week ?? null,
        practice_days_per_week: (data as any)?.practice_days_per_week ?? null,
        season_phase: (data as any)?.season_phase ?? null,
        class_types: (data as any)?.class_types ?? [],
        class_days_per_week: (data as any)?.class_days_per_week ?? null,
        mobility_frequency: (data as any)?.mobility_frequency ?? null,
        mobility_focus: (data as any)?.mobility_focus ?? null,
        cardio_outside_gym: (data as any)?.cardio_outside_gym ?? null,
        injuries: (data as any)?.injuries ?? null,
        training_experience: (data as any)?.training_experience ?? null,
      }}
    />
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-sm font-bold">{value}</div>
    </div>
  );
}

type DialogMode = null | "renewal" | "change" | "contact";

function MyPackageSection({ pkg }: { pkg: Pkg | null }) {
  const [mode, setMode] = useState<DialogMode>(null);
  const [target, setTarget] = useState<PackageKey | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const createFn = useServerFn(createPackageRequest);
  const listFn = useServerFn(listMyPackageRequests);

  const loadRequests = async () => {
    try {
      const data = await listFn();
      setRequests(data as any[]);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    loadRequests();
  }, []);

  const pkgInfo = pkg ? getPackage(pkg.package) : undefined;
  const status = (() => {
    if (!pkg) return { label: "Kein Paket", tone: "muted" as const };
    const end = new Date(pkg.end_date).getTime();
    const days = (end - Date.now()) / 86400000;
    if (days < 0) return { label: "Abgelaufen", tone: "warn" as const };
    if (days < 7) return { label: "Läuft aus", tone: "warn" as const };
    return { label: "Aktiv", tone: "ok" as const };
  })();

  const fmtDate = (s?: string | null) =>
    s ? new Date(s).toLocaleDateString("de-DE") : "—";

  const open = (m: Exclude<DialogMode, null>) => {
    setMode(m);
    setTarget("");
    setNote("");
  };

  const submit = async () => {
    if (mode === "change" && !target) {
      toast.error("Bitte Paket auswählen");
      return;
    }
    setSubmitting(true);
    try {
      await createFn({
        data: {
          request_type: mode!,
          requested_package: mode === "change" ? (target as PackageKey) : null,
          note: note || undefined,
        },
      });
      toast.success("Anfrage wurde an deinen Coach gesendet");
      setMode(null);
      loadRequests();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Mein Paket</h2>
        {pendingCount > 0 && (
          <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
            {pendingCount} offene Anfrage{pendingCount === 1 ? "" : "n"}
          </span>
        )}
      </div>

      {!pkg ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Du hast aktuell kein aktives Paket. Kontaktiere deinen Coach für mehr Infos.
        </p>
      ) : (
        <div className="mt-4 rounded-xl border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gold">
                Aktuelles Paket
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {PKG_LABEL[pkg.package as PackageKey] ?? pkg.package}
              </div>
              <div className="mt-1 font-display text-lg text-gold">
                {Number(pkg.price_eur).toFixed(0)} € / Monat
              </div>
            </div>
            <span
              className={
                "rounded-full px-3 py-1 text-xs font-semibold " +
                (status.tone === "ok"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : status.tone === "warn"
                    ? "bg-warning/20 text-warning"
                    : "bg-muted text-muted-foreground")
              }
            >
              {status.label}
            </span>
          </div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="text-muted-foreground">
              Aktiv seit:{" "}
              <span className="font-semibold text-foreground">
                {fmtDate(pkg.start_date)}
              </span>
            </div>
            <div className="text-muted-foreground">
              Nächste Verlängerung:{" "}
              <span className="font-semibold text-foreground">
                {fmtDate(pkg.end_date)}
              </span>
            </div>
          </div>
          {pkgInfo && (
            <ul className="mt-4 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {pkgInfo.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button
          onClick={() => open("renewal")}
          className="bg-gradient-gold text-primary-foreground"
        >
          <RefreshCcw className="mr-1 h-4 w-4" />
          Paket verlängern
        </Button>
        <Button onClick={() => open("change")} variant="secondary">
          <ArrowLeftRight className="mr-1 h-4 w-4" />
          Paket wechseln
        </Button>
        <Button onClick={() => open("contact")} variant="outline">
          <MessageSquare className="mr-1 h-4 w-4" />
          Coach kontaktieren
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Verlängerungen und Paketwechsel werden als Anfrage an deinen Coach
        gesendet — keine automatische Zahlung.
      </p>

      {requests.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Meine Anfragen
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/40 p-3"
              >
                <div>
                  <div className="font-semibold">
                    {r.request_type === "renewal"
                      ? "Verlängerung"
                      : r.request_type === "change"
                        ? `Wechsel → ${PKG_LABEL[r.requested_package as PackageKey] ?? r.requested_package ?? "—"}`
                        : "Kontaktanfrage"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(r.created_at)}
                    {r.coach_note ? ` · ${r.coach_note}` : ""}
                  </div>
                </div>
                <span
                  className={
                    "rounded-full px-2 py-1 text-xs font-semibold " +
                    (r.status === "approved"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : r.status === "declined"
                        ? "bg-destructive/20 text-destructive"
                        : "bg-warning/20 text-warning")
                  }
                >
                  {r.status === "pending"
                    ? "Offen"
                    : r.status === "approved"
                      ? "Genehmigt"
                      : "Abgelehnt"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "renewal"
                ? "Paket verlängern"
                : mode === "change"
                  ? "Paket wechseln"
                  : "Coach kontaktieren"}
            </DialogTitle>
            <DialogDescription>
              {mode === "renewal"
                ? "Schicke deinem Coach eine Anfrage zur Verlängerung deines aktuellen Pakets."
                : mode === "change"
                  ? "Wähle dein Wunschpaket. Dein Coach meldet sich mit den nächsten Schritten."
                  : "Stell deine Frage – dein Coach meldet sich zeitnah."}
            </DialogDescription>
          </DialogHeader>

          {mode === "change" && (
            <div className="space-y-3">
              {PACKAGES.map((p) => {
                const selected = target === p.key;
                const isCurrent = pkg?.package === p.key;
                return (
                  <button
                    type="button"
                    key={p.key}
                    onClick={() => setTarget(p.key)}
                    className={
                      "w-full rounded-xl border p-4 text-left transition " +
                      (selected
                        ? "border-gold bg-gold/10"
                        : "border-border hover:border-gold/40")
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-display text-base font-bold">
                        {p.name}
                        {p.popular && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold">
                            <Sparkles className="h-3 w-3" />
                            Beliebt
                          </span>
                        )}
                      </div>
                      <div className="font-display text-lg text-gold">
                        {p.price} €
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {p.tagline}
                    </div>
                    {isCurrent && (
                      <div className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                        Dein aktuelles Paket
                      </div>
                    )}
                    <ul className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      {p.features.slice(0, 4).map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-gold" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <Label>Nachricht (optional)</Label>
            <Textarea
              rows={4}
              placeholder="z. B. Wunschstart, Fragen ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMode(null)}>
              Abbrechen
            </Button>
            <Button
              onClick={submit}
              disabled={submitting}
              className="bg-gradient-gold text-primary-foreground"
            >
              Anfrage senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
