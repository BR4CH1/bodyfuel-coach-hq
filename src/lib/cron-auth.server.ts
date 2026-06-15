/**
 * Shared auth check for cron hooks. Verifies a strong, project-internal
 * `CRON_HOOK_SECRET` provided either as `Authorization: Bearer <secret>` or as
 * an `x-cron-secret` header. The previously-used `apikey` (Supabase
 * publishable/anon key) is NO LONGER accepted, because that key is exposed in
 * the browser bundle and would let anyone trigger our cron endpoints.
 */
export function verifyCronAuth(request: Request): { ok: true } | { ok: false; response: Response } {
  const secret = process.env.CRON_HOOK_SECRET;
  if (!secret) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Server misconfigured: CRON_HOOK_SECRET missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const custom = request.headers.get("x-cron-secret");
  const provided = bearer || custom || "";

  // Constant-time-ish comparison
  if (provided.length !== secret.length || provided !== secret) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  return { ok: true };
}
