import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCoachOrOrgStaffForAthlete } from "@/lib/organizations/org-coach-access";

export const getAthleteCourseInstructor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.userId !== context.userId) {
      await assertCoachOrOrgStaffForAthlete(context, data.userId, "athlete");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("is_course_instructor")
      .eq("id", data.userId)
      .maybeSingle();
    return { enabled: !!(row as any)?.is_course_instructor };
  });

export const setAthleteCourseInstructor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCoachOrOrgStaffForAthlete(context, data.userId, "athlete");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_course_instructor: data.enabled } as any)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });
