import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, ShieldCheck, Loader2 } from "lucide-react";
import { useSession } from "@/lib/bodyfuel/session";
import {
  acceptTeamJoinLink,
  getTeamJoinLinkPreview,
} from "@/lib/organizations/team-join-links.functions";
import { Button } from "@/components/ui/button";

type Preview =
  | {
      ok: true;
      organization: { id: string; name: string; slug: string; logo_url: string | null; primary_color: string | null };
      team: { id: string; name: string };
    }
  | { ok: false; reason: string };

export const Route = createFileRoute("/join/$token")({
  head: () => ({ meta: [{ title: "Team beitreten — BODYFUEL" }] }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const previewFn = useServerFn(getTeamJoinLinkPreview);
  const acceptFn = useServerFn(acceptTeamJoinLink);

  const [info, setInfo] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const autoAcceptedRef = useState({ done: false })[0];

  useEffect(() => {
    previewFn({ data: { token } })
      .then((res) => setInfo(res as Preview))
      .catch(() => setInfo({ ok: false, reason: "error" }));
  }, [previewFn, token]);

  const doAccept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await acceptFn({ data: { token } });
      if (!res.ok) throw new Error("Beitritt fehlgeschlagen.");
      toast.success("Willkommen im Team!");
      const slug = res.org_slug;
      if (!slug) {
        navigate({ to: "/" });
        return;
      }
      if (res.needs_onboarding) {
        navigate({ to: "/$orgSlug/onboarding", params: { orgSlug: slug }, replace: true });
      } else {
        navigate({ to: "/$orgSlug/home", params: { orgSlug: slug }, replace: true });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Beitritt fehlgeschlagen.");
      setBusy(false);
    }
  };

  // Auto-accept sobald eingeloggt: kein Extra-Klick nötig.
  useEffect(() => {
    if (loading || !supabaseUser || autoAcceptedRef.done) return;
    if (!info || info.ok === false) return;
    autoAcceptedRef.done = true;
    void doAccept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, supabaseUser, info]);

  if (!info) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!info.ok) {
    const label =
      info.reason === "not_found" ? "Beitrittslink nicht gefunden."
      : info.reason === "revoked" ? "Dieser Beitrittslink wurde deaktiviert."
      : info.reason === "expired" ? "Dieser Beitrittslink ist abgelaufen."
      : info.reason === "exhausted" ? "Dieser Beitrittslink hat sein Nutzungslimit erreicht."
      : "Beitrittslink ungültig.";
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div className="max-w-md space-y-3">
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="font-display text-xl font-bold">{label}</h1>
          <p className="text-sm text-muted-foreground">Bitte frag deinen Coach nach einem neuen Link.</p>
          <Link to="/" className="inline-block text-xs uppercase tracking-wider text-primary">Zur Startseite</Link>
        </div>
      </div>
    );
  }

  const bg = info.organization.primary_color ?? "#000000";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md px-5 py-10">
        <div
          className="mb-6 flex items-center gap-3 rounded-2xl border border-border p-4"
          style={{ background: `${bg}20` }}
        >
          {info.organization.logo_url ? (
            <img src={info.organization.logo_url} alt={info.organization.name} className="h-12 w-12 rounded-lg object-contain" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-muted"><Users className="h-6 w-6" /></div>
          )}
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Einladung</div>
            <div className="font-display text-lg font-bold leading-tight">{info.organization.name}</div>
            <div className="text-sm text-muted-foreground">Team: {info.team.name}</div>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !supabaseUser ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Melde dich an oder erstelle einen Account, um {info.team.name} beizutreten. Nach dem Login wirst du direkt weitergeleitet.
            </p>
            <Link
              to="/auth"
              search={{ next: `/join/${token}` }}
              className="block w-full rounded-lg bg-primary py-3 text-center text-sm font-bold uppercase tracking-wider text-primary-foreground"
            >
              Anmelden / Registrieren
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Als <span className="font-semibold">{supabaseUser.email}</span> {info.team.name} beitreten?
            </p>
            <Button onClick={doAccept} disabled={busy} className="w-full">
              {busy ? "Trete bei…" : `${info.team.name} beitreten`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
