import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RankingEntry = {
  user_id: string;
  nickname: string | null;
  display_name: string | null;
  total_points: number;
  level: number;
  current_streak: number;
  weekly_points: number;
};

export const getRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_ranking" as any);
    if (error) throw new Error(error.message);
    return (data ?? []) as RankingEntry[];
  });

export const getMyNickname = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("nickname")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { nickname: (data as any)?.nickname ?? null };
  });

export const setMyNickname = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nickname: string }) => d)
  .handler(async ({ data, context }) => {
    const nick = (data.nickname ?? "").trim();
    if (!/^[A-Za-z0-9_-]{2,20}$/.test(nick)) {
      throw new Error("Nickname: 2–20 Zeichen, nur Buchstaben, Zahlen, _ oder -");
    }
    // case-insensitive uniqueness check
    const { data: existing, error: chkErr } = await context.supabase
      .from("profiles")
      .select("id")
      .ilike("nickname", nick)
      .neq("id", context.userId)
      .maybeSingle();
    if (chkErr) throw new Error(chkErr.message);
    if (existing) throw new Error("Nickname ist bereits vergeben.");

    const { error } = await context.supabase
      .from("profiles")
      .update({ nickname: nick } as any)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, nickname: nick };
  });
