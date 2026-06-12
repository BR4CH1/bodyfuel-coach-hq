import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Ziel</Label>
            <Select
              value={profile?.coaching_goal ?? ""}
              onValueChange={(v) =>
                setProfile((p) => (p ? { ...p, coaching_goal: v } : p))
              }
            >
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
              value={profile?.next_checkin_date ?? ""}
              onChange={(e) =>
                setProfile((p) =>
                  p ? { ...p, next_checkin_date: e.target.value || null } : p,
                )
              }
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

        <Button
          onClick={saveCoaching}
          disabled={saving}
          className="mt-4 bg-gradient-gold text-primary-foreground"
        >
          <Save className="mr-1 h-4 w-4" />
          Speichern
        </Button>
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
