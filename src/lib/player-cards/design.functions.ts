/**
 * Player Card Design — Server Functions
 *
 * Verwaltet Karten-Designs (Template-Bild + Layout) pro Verein.
 * Jeder Verein hat genau eine Vorlage (identifiziert über den Slug),
 * die Design-Tabelle nutzt `scope = organization_slug` als UNIQUE-Key.
 *
 * Coaches können pro Verein eine eigene Vorlage pflegen. Weitere Vereine
 * können nachträglich einfach durch Anlage eines neuen Datensatzes
 * (scope = neuer Slug) ergänzt werden.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PlayerCardDesign = {
  organization_slug: string;
  name: string | null;
  template_url: string | null;
  template_uploaded_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout_json: any;
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
};

export const listPlayerCardDesigns = createServerFn({ method: "GET" })
  .handler(async (): Promise<PlayerCardDesign[]> => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await sb
      .from("player_card_design")
      .select("organization_slug,scope,name,template_url,template_uploaded_at,layout_json,is_published,published_at,updated_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      organization_slug: r.organization_slug ?? r.scope,
      name: r.name,
      template_url: r.template_url,
      template_uploaded_at: r.template_uploaded_at,
      layout_json: r.layout_json,
      is_published: r.is_published,
      published_at: r.published_at,
      updated_at: r.updated_at,
    }));
  });

export const getPlayerCardDesign = createServerFn({ method: "GET" })
  .validator((data: { orgSlug?: string | null } | undefined) =>
    z.object({ orgSlug: z.string().min(1).nullable().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<PlayerCardDesign | null> => {
    const orgSlug = data.orgSlug ?? null;
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let query = sb
      .from("player_card_design")
      .select("organization_slug,scope,name,template_url,template_uploaded_at,layout_json,is_published,published_at,updated_at");
    if (orgSlug) query = query.eq("scope", orgSlug);
    const { data: row, error } = await query.limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      organization_slug: (row as any).organization_slug ?? (row as any).scope,
      name: (row as any).name,
      template_url: (row as any).template_url,
      template_uploaded_at: (row as any).template_uploaded_at,
      layout_json: (row as any).layout_json,
      is_published: (row as any).is_published,
      published_at: (row as any).published_at,
      updated_at: (row as any).updated_at,
    };
  });

export const savePlayerCardDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    orgSlug: string;
    name?: string | null;
    layout_json: any;
    template_data_url?: string | null;
    publish?: boolean;
  }) =>
    z.object({
      orgSlug: z.string().min(1),
      name: z.string().min(1).nullable().optional(),
      layout_json: z.record(z.string(), z.any()),
      template_data_url: z.string().nullable().optional(),
      publish: z.boolean().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isCoach } = await supabase.rpc("has_role", { _user_id: userId, _role: "coach" });
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "platform_owner" });
    if (!isCoach && !isOwner) throw new Error("Forbidden");

    const patch: Record<string, unknown> = {
      scope: data.orgSlug,
      organization_slug: data.orgSlug,
      layout_json: data.layout_json,
      created_by: userId,
    };
    if (typeof data.name === "string") patch.name = data.name;
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
      .select("organization_slug,scope,name,template_url,template_uploaded_at,layout_json,is_published,published_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return {
      organization_slug: (row as any).organization_slug ?? (row as any).scope,
      name: (row as any).name,
      template_url: (row as any).template_url,
      template_uploaded_at: (row as any).template_uploaded_at,
      layout_json: (row as any).layout_json,
      is_published: (row as any).is_published,
      published_at: (row as any).published_at,
      updated_at: (row as any).updated_at,
    } as PlayerCardDesign;
  });
