import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Aktiviert den jüngsten Draft-Plan eines Smart-Nutzers (training oder nutrition)
 * direkt — ohne Coach-Freigabe. Wird nach der AI-Generierung im Onboarding
 * und bei "Smart-Plan generieren" automatisch aufgerufen.
 *
 * - Findet jüngsten Plan mit Status draft/approved/published
 * - Archiviert aktuell aktiven Plan desselben Typs
 * - Setzt neuen Plan auf 'active'
 */
export const activateLatestSmartPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { user_id: string; plan_type: "nutrition" | "training" }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.user_id;

    // Self or coach only
    if (target !== userId) {
      const { data: isCoach } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "coach",
      });
      if (!isCoach) throw new Error("Forbidden");
    }

    const { data: candidate } = await supabase
      .from("nutrition_plans")
      .select("id, status, created_at")
      .eq("client_id", target)
      .eq("plan_type", data.plan_type)
      .eq("performance_context", false)
      .in("status", ["draft", "approved", "published"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!candidate) return { ok: false, reason: "no_draft" };

    // Archive currently active (personal track only — never touches
    // performance_context=true plans, which live on the Bulls track).
    await supabase
      .from("nutrition_plans")
      .update({ status: "archived" })
      .eq("client_id", target)
      .eq("plan_type", data.plan_type)
      .eq("performance_context", false)
      .eq("status", "active");


    const { error } = await supabase
      .from("nutrition_plans")
      .update({ status: "active" })
      .eq("id", candidate.id);

    if (error) throw new Error(error.message);
    return { ok: true, plan_id: candidate.id };
  });
