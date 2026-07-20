/**
 * Shared auth check for cron hooks. Accepts ONLY a private project-internal
 * secret via `Authorization: Bearer ...`, `x-cron-secret`, or `apikey` header.
 *
 * The Supabase publishable/anon key is NOT accepted because it is shipped in
 * the browser bundle and is therefore public. Cron jobs (pg_cron, external
 * schedulers) must send `CRON_HOOK_SECRET` instead.
 */
export function verifyCronAuth(request: Request): { ok: true } | { ok: false; response: Response } {
  const cronSecret = process.env.CRON_HOOK_SECRET;

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const custom = request.headers.get("x-cron-secret") || "";
  const apiKey = request.headers.get("apikey") || "";

  const matchesSecret =
    !!cronSecret &&
    [bearer, custom, apiKey].some(
      (v) => v.length === cronSecret.length && v === cronSecret,
    );

  if (matchesSecret) return { ok: true };

  return {
    ok: false,
    response: new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
  };
}

