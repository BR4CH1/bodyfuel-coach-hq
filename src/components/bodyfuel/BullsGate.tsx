import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/lib/bodyfuel/session";

export function BullsGate({ children }: { children: ReactNode }) {
  const { hasGroup, isFreeUser, loading, supabaseUser } = useSession();
  const navigate = useNavigate();
  const allowed = hasGroup("bulls") || isFreeUser;

  useEffect(() => {
    if (loading) return;
    if (!supabaseUser) {
      navigate({ to: "/auth" });
      return;
    }
    if (!allowed) {
      navigate({ to: "/dashboard" });
    }
  }, [allowed, loading, supabaseUser, navigate]);

  if (loading) return null;
  if (!supabaseUser || !allowed) return null;
  return <div className="bulls-theme">{children}</div>;
}
