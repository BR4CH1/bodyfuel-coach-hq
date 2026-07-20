import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FreeAppLayout } from "@/components/bodyfuel/FreeAppLayout";
import { SmartUpgradePopup } from "@/components/bodyfuel/SmartUpgradePopup";
import { useSession } from "@/lib/bodyfuel/session";
import { seedFromUserMetadata } from "@/lib/free-targets.functions";

export const Route = createFileRoute("/tracker/app")({
  head: () => ({ meta: [{ title: "BodyFuel Tracker" }] }),
  component: TrackerAppLayout,
});

function TrackerAppLayout() {
  const { supabaseUser } = useSession();
  const seed = useServerFn(seedFromUserMetadata);
  const tried = useRef<string | null>(null);

  useEffect(() => {
    if (!supabaseUser) return;
    if (tried.current === supabaseUser.id) return;
    tried.current = supabaseUser.id;
    seed().catch((e) => console.error("seedFromUserMetadata failed", e));
  }, [supabaseUser, seed]);

  return (
    <FreeAppLayout>
      <Outlet />
      <SmartUpgradePopup />
    </FreeAppLayout>
  );
}
