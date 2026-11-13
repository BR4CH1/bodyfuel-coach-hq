import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccountSetup, completeAccountSetup } from "@/lib/account-setup.functions";

export const Route = createFileRoute("/zugang/$token")({
  head: () => ({
    meta: [
      { title: "Zugang einrichten — BODYFUEL" },
      { name: "description", content: "Passwort festlegen und deinen BODYFUEL-Zugang starten." },
      { property: "og:title", content: "Zugang einrichten — BODYFUEL" },
      { property: "og:description", content: "Passwort festlegen und deinen BODYFUEL-Zugang starten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const fetchSetup = useServerFn(getAccountSetup);
  const complete = useServerFn(completeAccountSetup);
  const [email, setEmail] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSetup({ data: { token } })
      .then((r) => (r.ok ? setEmail(r.email) : setInvalid(true)))
      .catch(() => setInvalid(true));
  }, [token, fetchSetup]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Bitte mindestens 8 Zeichen.");
    if (password !== confirmation) return toast.error("Die Passwörter stimmen nicht überein.");
    setSaving(true);
    try {
      const r = await complete({ data: { token, password } });
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithPassword({ email: r.email, password });
      if (error) throw error;
      toast.success("Passwort gespeichert – los geht's!");
      navigate({ to: "/welcome" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Das hat nicht geklappt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-primary"><Lock className="h-5 w-5" /><h1 className="text-xl font-bold text-foreground">Zugang einrichten</h1></div>
        {invalid ? (
          <p className="text-sm text-muted-foreground">Dieser Link ist ungültig. Bitte wende dich an deinen Coach.</p>
        ) : !email ? (
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-muted-foreground">Konto: <span className="text-foreground">{email}</span></p>
            <div className="space-y-2"><Label htmlFor="pw">Passwort</Label><Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="pw2">Passwort wiederholen</Label><Input id="pw2" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></div>
            <Button type="submit" className="w-full h-11" disabled={saving}>{saving ? "Speichere…" : "Passwort festlegen & starten"}</Button>
          </form>
        )}
      </div>
    </main>
  );
}
