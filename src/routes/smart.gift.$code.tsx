import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Gift, Lock, Mail, Sparkles, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/bodyfuel/Logo";
import { redeemGiftCode, validateGiftCode } from "@/lib/smart-gifts.functions";

export const Route = createFileRoute("/smart/gift/$code")({
  head: () => ({
    meta: [
      { title: "Dein BodyFuel Smart Geschenk" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GiftRedeemPage,
});

const schema = z.object({
  first_name: z.string().trim().min(1, "Vorname erforderlich").max(60),
  last_name: z.string().trim().min(1, "Nachname erforderlich").max(60),
  email: z.string().trim().email("Ungültige E-Mail").max(255),
  password: z.string().min(8, "Mindestens 8 Zeichen").max(100),
});

function GiftRedeemPage() {
  const { code } = useParams({ from: "/smart/gift/$code" });
  const navigate = useNavigate();
  const { supabaseUser, loading } = useSession();
  const validate = useServerFn(validateGiftCode);
  const redeem = useServerFn(redeemGiftCode);
  const [busy, setBusy] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  const { data: info, isLoading } = useQuery({
    queryKey: ["gift-code", code],
    queryFn: () => validate({ data: { code } }),
  });

  // Auto-redeem nach E-Mail-Bestätigung: Sobald der User eingeloggt ist und der Code gültig ist,
  // lösen wir automatisch ein (z.B. wenn Telly nach Verifizierung den Link erneut öffnet).
  const autoRedeemTried = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (!supabaseUser) return;
    if (!info?.valid) return;
    if (autoRedeemTried.current || redeemed || busy) return;
    autoRedeemTried.current = true;
    (async () => {
      setBusy(true);
      try {
        const res = await redeem({ data: { code } });
        setRedeemed(true);
        toast.success(`${info.hub_label ?? "Mitgliedschaft"} freigeschaltet — willkommen!`);
        navigate({ to: res.hub_kind === "group" ? "/bulls" : "/onboarding/smart" });
      } catch (e: any) {
        const msg = e?.message ?? "";
        // Bereits eingelöst / Code verbraucht → still ignorieren und zum passenden Bereich leiten
        if (/bereits eingelöst|bereits ein/i.test(msg)) {
          navigate({ to: info.hub_kind === "group" ? "/bulls" : "/onboarding/smart" });
          return;
        }
        toast.error(msg || "Einlösen fehlgeschlagen");
      } finally {
        setBusy(false);
      }
    })();
  }, [loading, supabaseUser, info, code, redeem, navigate, redeemed, busy]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const v = parsed.data;
    setBusy(true);
    try {
      const display_name = `${v.first_name} ${v.last_name}`.trim();
      const { data, error } = await supabase.auth.signUp({
        email: v.email.toLowerCase(),
        password: v.password,
        options: {
          emailRedirectTo: `${window.location.origin}/smart/gift/${code}`,
          data: {
            tier: "smart",
            display_name,
            first_name: v.first_name,
            last_name: v.last_name,
          },
        },
      });
      if (error) throw error;
      if (!data.session) {
        toast.success("Bitte bestätige deine E-Mail und öffne den Link erneut.");
        return;
      }
      const res = await redeem({ data: { code } });
      setRedeemed(true);
      toast.success(`${info?.valid ? info.hub_label : "Mitgliedschaft"} freigeschaltet — willkommen!`);
      navigate({ to: res.hub_kind === "group" ? "/bulls" : "/onboarding/smart" });
    } catch (err: any) {
      const msg = /already registered|user already/i.test(err?.message ?? "")
        ? "Diese E-Mail ist bereits registriert. Bitte einloggen, dann öffne den Link erneut."
        : err?.message ?? "Registrierung fehlgeschlagen";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-gold/15 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-gold/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-gold sm:p-9">
        <div className="mb-5 flex items-center justify-between">
          <Logo />
          <div className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-gold">
            <Gift className="h-3 w-3" /> Geschenk
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Code wird geprüft…</p>
        ) : !info?.valid ? (
          <>
            <h1 className="font-display text-2xl font-bold">Code nicht gültig</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {info?.reason ?? "Bitte prüfe den Link."}
            </p>
            <Link to="/smart" className="mt-4 inline-block text-sm text-gold hover:underline">
              ← Zur Smart-Übersicht
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">
              Glückwunsch — {info.days} Tage Smart geschenkt!
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {info.label ? `${info.label} · ` : ""}Erstelle dir kostenlos einen Account und leg sofort los. Keine Zahlungsdaten nötig.
            </p>

            {supabaseUser ? (
              <div className="mt-6 space-y-3">
                <p className="text-sm">Eingeloggt als <span className="font-semibold">{supabaseUser.email}</span>. Klicke auf „Jetzt freischalten", um deinen Code einzulösen.</p>
                <Button
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await redeem({ data: { code } });
                      navigate({ to: "/onboarding/smart" });
                    } catch (e: any) {
                      toast.error(e?.message ?? "Fehler");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  disabled={busy || redeemed}
                  className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
                >
                  <Sparkles className="mr-2 h-4 w-4" /> Jetzt freischalten
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">Vorname</Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="first_name" name="first_name" required autoComplete="given-name" className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name">Nachname</Label>
                    <Input id="last_name" name="last_name" required autoComplete="family-name" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-Mail</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" name="email" type="email" required autoComplete="email" className="pl-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Passwort</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="pl-9" />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
                >
                  {busy ? "…" : "Account erstellen & einlösen"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Schon dabei?{" "}
                  <Link to="/auth" className="text-gold hover:underline">Einloggen</Link>
                  {" "}und Link erneut öffnen.
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
