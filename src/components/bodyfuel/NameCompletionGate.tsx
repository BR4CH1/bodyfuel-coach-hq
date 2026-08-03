import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/bodyfuel/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";
import { useLocation } from "@tanstack/react-router";

/**
 * Prüft, ob ein `display_name` als vollständiger Vor- + Nachname durchgeht.
 * Zu wenig: leer, kein Leerzeichen, enthält Ziffern/Punkte/@ (typische Usernamen
 * wie "ingo.wigger" oder "maxr24801"), oder Teile kürzer als 2 Zeichen.
 */
export function isNameIncomplete(name: string | null | undefined): boolean {
  if (!name) return true;
  const t = name.trim();
  if (t.length < 3) return true;
  if (/[0-9@._]/.test(t)) return true;
  const parts = t.split(/\s+/);
  if (parts.length < 2) return true;
  if (parts.some((p) => p.replace(/[-']/g, "").length < 2)) return true;
  return false;
}

const nameSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(2, "Vorname zu kurz")
    .max(60, "Vorname zu lang")
    .regex(/^[\p{L}][\p{L}\s'\-]*$/u, "Nur Buchstaben, Bindestrich, Leerzeichen"),
  last_name: z
    .string()
    .trim()
    .min(2, "Nachname zu kurz")
    .max(60, "Nachname zu lang")
    .regex(/^[\p{L}][\p{L}\s'\-]*$/u, "Nur Buchstaben, Bindestrich, Leerzeichen"),
});

export function NameCompletionGate() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { supabaseUser, loading } = useSession();
  const [display, setDisplay] = useState<string | null | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!supabaseUser) {
      setChecked(false);
      setDisplay(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", supabaseUser.id)
        .maybeSingle();
      if (cancelled) return;
      setDisplay(data?.display_name ?? null);
      setChecked(true);
      // Prefill aus Auth-Metadata (falls beim Signup gesetzt) — sonst bleiben
      // die Felder leer. Wichtig für per Invite/Import angelegte User, damit
      // sie nicht bei Null anfangen.
      const meta = (supabaseUser.user_metadata ?? {}) as {
        first_name?: string;
        last_name?: string;
        given_name?: string;
        family_name?: string;
      };
      const mf = (meta.first_name ?? meta.given_name ?? "").toString().trim();
      const ml = (meta.last_name ?? meta.family_name ?? "").toString().trim();
      if (mf) setFirst((v) => v || mf);
      if (ml) setLast((v) => v || ml);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseUser, loading]);

  const incomplete = useMemo(() => checked && isNameIncomplete(display), [checked, display]);

  // Wenn der Gate offen ist, den Body-Scroll sperren, damit die
  // dahinterliegende Route nicht weiterscrollt/rendert und den Fokus aus
  // dem Input reißt (Ursache: „Man kann keinen Namen eingeben").
  useEffect(() => {
    if (!incomplete) return;
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [incomplete]);

  const isAuthFlow =
    pathname === "/welcome" ||
    pathname === "/auth" ||
    pathname === "/login" ||
    pathname === "/reset-password";
  if (!supabaseUser || !incomplete || isAuthFlow) return null;

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = nameSchema.safeParse({ first_name: first, last_name: last });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const full = `${parsed.data.first_name} ${parsed.data.last_name}`.replace(/\s+/g, " ").trim();
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: full })
        .eq("id", supabaseUser.id);
      if (error) throw error;
      // Auch die auth-Metadaten aktualisieren, damit andere Systeme die Namen sehen.
      try {
        await supabase.auth.updateUser({
          data: {
            display_name: full,
            first_name: parsed.data.first_name,
            last_name: parsed.data.last_name,
          },
        });
      } catch {
        /* Metadaten sind sekundär */
      }
      setDisplay(full);
      toast.success("Danke, dein Name wurde gespeichert.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-background/95 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onPointerDownCapture={(e) => e.stopPropagation()}
      onClickCapture={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-gold sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold">
            <User className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Bitte vervollständige deinen Namen</h2>
            <p className="text-xs text-muted-foreground">
              Dein Coach und dein Team sehen deinen echten Namen — nicht deine E-Mail.
            </p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ncg-first">Vorname</Label>
              <Input
                id="ncg-first"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                autoComplete="given-name"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ncg-last">Nachname</Label>
              <Input
                id="ncg-last"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            {busy ? "…" : "Namen speichern"}
          </Button>
        </form>
      </div>
    </div>
  );
}
