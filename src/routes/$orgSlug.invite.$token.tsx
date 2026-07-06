import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/bodyfuel/session";
import { acceptOrganizationInvite } from "@/lib/organizations/organizations.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/$orgSlug/invite/$token")({
  component: InviteAccept,
});

function InviteAccept() {
  const { orgSlug, token } = Route.useParams();
  const { supabaseUser, loading } = useSession();
  const navigate = useNavigate();
  const accept = useServerFn(acceptOrganizationInvite);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!supabaseUser) {
      navigate({
        to: "/auth",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        search: { next: `/${orgSlug}/invite/${token}` } as any,
        replace: true,
      });
      return;
    }
    if (status !== "idle") return;
    setStatus("working");
    accept({ data: { token } })
      .then((res) => {
        toast.success("Zugang aktiviert.");
        navigate({ to: "/$orgSlug", params: { orgSlug: res.slug ?? orgSlug }, replace: true });
      })
      .catch((e: any) => {
        setError(e?.message ?? "Einladung ungültig");
        setStatus("error");
      });
  }, [supabaseUser, loading, status, accept, token, orgSlug, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      {status === "error" ? (
        <div className="max-w-sm">
          <h1 className="font-display text-xl font-semibold">Einladung ungültig</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button asChild className="mt-6" variant="outline">
            <Link to="/dashboard">Zu meinem BODYFUEL</Link>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Einladung wird geprüft…</p>
      )}
    </div>
  );
}
