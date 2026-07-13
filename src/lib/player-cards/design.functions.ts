/**
 * Player Card Design — Server Functions
 *
 * Verwaltet das globale Karten-Design: Template-Bild (als Data-URL in
 * der DB) + Layout-Positionen. Wird im Coach-Layout-Editor gepflegt und
 * anschließend beim Rendern der Spielerkarten geladen.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SCOPE = "global";

export type PlayerCardDesign = {
  template_url: string | null;
  template_uploaded_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout_json: any;
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
};

export const getPlayerCardDesign = createServerFn({ method: "GET" })
  .handler(async (): Promise<PlayerCardDesign | null> => {
    // Öffentlich lesbar — nutzt den Anon-Client für SSR-Safe-Reads.
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await sb
      .from("player_card_design")
      .select("template_url,template_uploaded_at,layout_json,is_published,published_at,updated_at")
      .eq("scope", SCOPE)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as PlayerCardDesign | null;
  });

export const savePlayerCardDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    layout_json: any;
    template_data_url?: string | null;
    publish?: boolean;
  }) =>
    z.object({
      layout_json: z.record(z.string(), z.any()),
      template_data_url: z.string().nullable().optional(),
      publish: z.boolean().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Autorisierung — nur Coach/platform_owner dürfen speichern.
    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "platform_owner" });
    if (!isCoach && !isOwner) throw new Error("Forbidden");

    const patch: Record<string, unknown> = {
      scope: SCOPE,
      layout_json: data.layout_json,
      created_by: userId,
    };
    if (typeof data.template_data_url === "string") {
      patch.template_url = data.template_data_url;
      patch.template_uploaded_at = new Date().toISOString();
    }
    if (data.publish === true) {
      patch.is_published = true;
      patch.published_at = new Date().toISOString();
    } else if (data.publish === false) {
      patch.is_published = false;
    }

    const { data: row, error } = await supabase
      .from("player_card_design")
      .upsert(patch, { onConflict: "scope" })
      .select("template_url,template_uploaded_at,layout_json,is_published,published_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as PlayerCardDesign;
  });
