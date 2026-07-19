import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProgressPose = "front" | "side_left" | "side_right" | "back";

export type ProgressPhoto = {
  id: string;
  user_id: string;
  taken_on: string;
  pose: ProgressPose;
  file_path: string;
  note: string | null;
  created_at: string;
  url?: string;
};

const poseEnum = z.enum(["front", "side_left", "side_right", "back"]);

export const listProgressPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId?: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const target = data.userId ?? context.userId;
    const limit = data.limit ?? 100;
    const { data: rows, error } = await context.supabase
      .from("progress_photos")
      .select("*")
      .eq("user_id", target)
      .order("taken_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    const photos = (rows ?? []) as ProgressPhoto[];
    // Sign URLs (1h)
    const out: ProgressPhoto[] = [];
    for (const p of photos) {
      const { data: signed } = await context.supabase.storage
        .from("progress-photos")
        .createSignedUrl(p.file_path, 60 * 60);
      out.push({ ...p, url: signed?.signedUrl });
    }
    return out;
  });

export const registerProgressPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { file_path: string; pose: ProgressPose; taken_on?: string; note?: string }) =>
    z
      .object({
        file_path: z.string().min(1),
        pose: poseEnum,
        taken_on: z.string().date().optional(),
        note: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // file_path must start with the user's id (matches storage policy)
    if (!data.file_path.startsWith(`${context.userId}/`)) {
      throw new Error("Ungültiger Pfad");
    }
    const { error } = await context.supabase.from("progress_photos").insert({
      user_id: context.userId,
      file_path: data.file_path,
      pose: data.pose,
      taken_on: data.taken_on ?? new Date().toISOString().slice(0, 10),
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProgressPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error: e1 } = await context.supabase
      .from("progress_photos")
      .select("file_path, user_id")
      .eq("id", data.id)
      .single();
    if (e1 || !row) throw new Error(e1?.message ?? "Foto nicht gefunden");
    await context.supabase.storage.from("progress-photos").remove([row.file_path]);
    const { error } = await context.supabase.from("progress_photos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
