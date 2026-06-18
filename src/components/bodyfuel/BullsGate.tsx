import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/lib/bodyfuel/session";

export function BullsGate({ children }: { children: ReactNode }) {
  const { hasGroup, loading, supabaseUser, isFreeUser } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!supabaseUser) {
      navigate({ to: "/auth" });
      return;
    }
    if (!hasGroup("bulls")) {
      navigate({ to: isFreeUser ? "/tracker/app" : "/dashboard" });
    }
  }, [hasGroup, loading, supabaseUser, isFreeUser, navigate]);

  if (loading) return null;
  if (!supabaseUser || !hasGroup("bulls")) return null;
  return <div className="bulls-theme">{children}</div>;
}

