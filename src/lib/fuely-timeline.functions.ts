import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FuelyTimelineEvent = {
  id: string;
  event_type: "morning_briefing" | "evening_review" | "action" | "milestone" | "memory";
  category: string | null;
  icon: string | null;
  title: string;
  summary: string | null;
  cta_label: string | null;
  cta_href: string | null;
  metadata: Record<string, unknown>;
  coach_visible: boolean;
  occurred_at: string;
  created_at: string;
};

export const listFuelyTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { limit?: number; before?: string; forUserId?: string; coachView?: boolean }) => ({
      limit: Math.min(60, Math.max(5, Number(input?.limit ?? 30))),
      before: input?.before,
      forUserId: input?.forUserId,
      coachView: !!input?.coachView,
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const targetUserId = data.forUserId ?? userId;
    const isSelf = targetUserId === userId;

    let q = supabase
      .from("fuely_timeline_events")
      .select(
        "id, event_type, category, icon, title, summary, cta_label, cta_href, metadata, coach_visible, occurred_at, created_at",
      )
      .eq("user_id", targetUserId)
      .order("occurred_at", { ascending: false })
      .limit(data.limit);

    // Für Coaches: RLS filtert bereits, aber wir erzwingen explizit coach_visible=true,
    // damit private Einträge nie im Coach-Kontext angezeigt werden.
    if (!isSelf || data.coachView) q = q.eq("coach_visible", true);
    if (data.before) q = q.lt("occurred_at", data.before);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as FuelyTimelineEvent[] };
  });

export const deleteFuelyTimelineEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("fuely_timeline_events")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
