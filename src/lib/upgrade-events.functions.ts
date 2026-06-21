import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UpgradeTier = "free" | "trial" | "smart" | "coaching";
export type UpgradeEventKind = "click" | "started" | "completed";

export type TierMetrics = {
  active: { free: number; trial: number; smart: number; coaching: number };
  clicks: { last7: number; last30: number };
  conversions: {
    trial_to_smart: number;
    trial_to_coaching: number;
    free_to_smart: number;
    free_to_coaching: number;
    smart_to_coaching: number;
  };
};

// === Track a single upgrade event ===
export const trackUpgradeEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      to_tier: UpgradeTier;
      from_tier?: UpgradeTier | null;
      event?: UpgradeEventKind;
      source?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("upgrade_events").insert({
      user_id: context.userId,
      to_tier: data.to_tier,
      from_tier: data.from_tier ?? null,
      event: data.event ?? "click",
      source: data.source ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// === Coach: tier metrics ===
export const getTierMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TierMetrics> => {
    const { data: isCoach, error: rErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "coach",
    });
    if (rErr) throw new Error(rErr.message);
    if (!isCoach) throw new Error("Nicht autorisiert");

    // Aktive Pakete (smart / coaching / starter / premium)
    const { data: pkgs } = await context.supabase
      .from("customer_packages")
      .select("package, user_id")
      .eq("is_active", true);

    const smartUsers = new Set<string>();
    const coachingUsers = new Set<string>();
    for (const p of (pkgs ?? []) as any[]) {
      if (p.package === "smart") smartUsers.add(p.user_id);
      else coachingUsers.add(p.user_id); // coaching/starter/premium
    }

    // Free-Rolle
    const { count: freeCount } = await context.supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "free");
    const free = freeCount ?? 0;

    // Trial: profiles.trial_status === 'trial' (deckungsgleich mit listTrialUsers)
    const { count: trialCount } = await context.supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("trial_status", "trial");
    const trial = trialCount ?? 0;

    // Upgrade-Events
    const now = Date.now();
    const d7 = new Date(now - 7 * 86400_000).toISOString();
    const d30 = new Date(now - 30 * 86400_000).toISOString();

    const { count: clicks7 } = await context.supabase
      .from("upgrade_events")
      .select("id", { count: "exact", head: true })
      .eq("event", "click")
      .gte("created_at", d7);
    const { count: clicks30 } = await context.supabase
      .from("upgrade_events")
      .select("id", { count: "exact", head: true })
      .eq("event", "click")
      .gte("created_at", d30);

    async function convCount(from: string, to: string) {
      const { count } = await context.supabase
        .from("upgrade_events")
        .select("id", { count: "exact", head: true })
        .eq("event", "completed")
        .eq("from_tier", from)
        .eq("to_tier", to)
        .gte("created_at", d30);
      return count ?? 0;
    }

    const [t2s, t2c, f2s, f2c, s2c] = await Promise.all([
      convCount("trial", "smart"),
      convCount("trial", "coaching"),
      convCount("free", "smart"),
      convCount("free", "coaching"),
      convCount("smart", "coaching"),
    ]);

    return {
      active: {
        free,
        trial,
        smart: smartUsers.size,
        coaching: coachingUsers.size,
      },
      clicks: { last7: clicks7 ?? 0, last30: clicks30 ?? 0 },
      conversions: {
        trial_to_smart: t2s,
        trial_to_coaching: t2c,
        free_to_smart: f2s,
        free_to_coaching: f2c,
        smart_to_coaching: s2c,
      },
    };
  });
